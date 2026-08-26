/**
 * dsh web 启动编排（P1-0）：从现有 `src/main.mjs` 抽出、供 dev 与 packaged
 * 共用的共享编排——解析 dsh CLI bin、确保 bc 插件就绪（dev `link:` / packaged
 * tarball）、以 ELECTRON_RUN_AS_NODE trampoline 起 dsh 常驻子进程、解析端口。
 *
 * 两条纪律（05-references §4.8 + P0-5 §4.3）：
 * - 子进程复用宿主 Electron 二进制（process.execPath），env 设
 *   `ELECTRON_RUN_AS_NODE=1` 跑 Node 模式，`--import <clear-env.mjs>` 在
 *   进 dsh 前删该变量（防泄漏到 dsh 派生的 pwsh/bash）；dsh CLI 需
 *   `--expose-internals`（Node internals）。纯 Node dev（runAsNode:false）
 *   不加这些 flag。
 * - 插件分发：dev = `link:<repo>/packages/<pkg>`（改码即生效）；packaged =
 *   `resources/plugins/<name>-<ver>.tgz`（`file:` tarball，离线、不可变拷贝），
 *   首启 `dsh plugin --profile web add <tgz>`，幂等标记存在即跳过。
 * @module desktop/src/launcher
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { createLogSink, scanPort } from './port-parse.mjs'

/** 解析 dsh CLI bin（`@deepseek-ai/dsh/package.json` 的 bin.dsh → lib/bin.js）。 */
export function resolveDshBin() {
  const require = createRequire(import.meta.url)
  const manifestPath = require.resolve('@deepseek-ai/dsh/package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const bin = manifest.bin?.dsh
  if (typeof bin !== 'string') throw new Error('desktop: @deepseek-ai/dsh has no "bin.dsh" entry')
  return join(dirname(manifestPath), bin)
}

/** bc 插件清单（scope 名 = 幂等标记键的一部分）。 */
const BC_PLUGINS = [
  { name: 'web-ui', scopeName: '@bc-agent/web-ui' },
  { name: 'capability-core', scopeName: '@bc-agent/capability-core' },
  { name: 'file-open', scopeName: '@bc-agent/file-open' },
]

/** profile 里已安装的幂等标记路径。 */
export function pluginInstalledMarker(dshHome, scopeName) {
  return join(dshHome, 'profiles', 'web', 'node_modules', scopeName, 'package.json')
}

/**
 * 组装 bc 插件安装描述。
 * @param options - `mode`（link/tarball）+ `repoRoot`（dev link 用）+ `resourcesDir`（packaged）。
 * @returns 插件安装描述数组。
 */
export function bcPluginSpecs(options) {
  return BC_PLUGINS.map((plugin) => {
    if (options.mode === 'link') {
      return {
        name: plugin.name,
        scopeName: plugin.scopeName,
        spec: `link:${join(options.repoRoot, 'packages', plugin.name)}`,
        buildDir: join(options.repoRoot, 'packages', plugin.name),
      }
    }
    const dir = join(options.resourcesDir, 'plugins')
    // pnpm pack 的 tarball 名：`@bc-agent/web-ui` → `bc-agent-web-ui-<ver>.tgz`（/ → -）。
    const prefix = `${plugin.scopeName.replace('@', '').replace('/', '-')}-`
    const tarball = readdirSync(dir).find(file => file.startsWith(prefix) && file.endsWith('.tgz'))
    if (tarball === undefined) throw new Error(`desktop: no tarball for ${plugin.scopeName} under ${dir}`)
    return { name: plugin.name, scopeName: plugin.scopeName, spec: join(dir, tarball) }
  })
}

/** dev：缺 lib/ 产物时自动 build（沿用现有 main.mjs 逻辑）。 */
function ensurePluginBuilt(plugin, env) {
  if (plugin.buildDir === undefined) return
  const libDir = join(plugin.buildDir, 'lib')
  if (existsSync(libDir) && readdirSync(libDir).length > 0) return
  const result = spawnSync(process.execPath, ['build.mjs'], { cwd: plugin.buildDir, env, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`desktop: failed to build ${plugin.scopeName}`)
}

/**
 * 确保 bc 插件已装进 profile（幂等）。packaged 用短命 dsh 子进程 `plugin add
 * <tarball>`；dev 用 `link:`。安装后复核标记，fail-loud。
 * @param options - mode/dshBin/childEnv/dshHome/repoRoot/resourcesDir/clearEnvUrl/runAsNode。
 */
export function ensurePluginsReady(options) {
  const plugins = bcPluginSpecs({ mode: options.mode, repoRoot: options.repoRoot, resourcesDir: options.resourcesDir })
  const nodePrefix = options.runAsNode ? ['--expose-internals', '--import', options.clearEnvUrl] : []
  for (const plugin of plugins) {
    if (options.mode === 'link') ensurePluginBuilt(plugin, options.childEnv)
    const marker = pluginInstalledMarker(options.dshHome, plugin.scopeName)
    if (existsSync(marker)) continue
    process.stderr.write(`desktop: installing ${plugin.scopeName} into the 'web' profile (${options.mode})\n`)
    const result = spawnSync(
      process.execPath,
      [...nodePrefix, options.dshBin, 'plugin', '--profile', 'web', 'add', plugin.spec],
      { env: options.childEnv, stdio: 'inherit' },
    )
    if (result.status !== 0) throw new Error(`desktop: dsh plugin add failed for ${plugin.scopeName} (exit ${String(result.status)})`)
    if (!existsSync(marker)) throw new Error(`desktop: ${plugin.scopeName} still unresolvable after install (${marker})`)
  }
}

/** 构建子进程 env：DSH_HOME（per-brand）、DSH_BUNDLED_SKILL_DIR（内置技能根）、DSH_TELEMETRY_DISABLED、私有 PATH、RUN_AS_NODE。 */
export function buildChildEnv(options) {
  const env = {
    ...process.env,
    // 子进程复用 Electron 二进制跑 Node 模式；clear-env.mjs 在进 dsh 前删除它。
    ELECTRON_RUN_AS_NODE: '1',
    PATH: `${options.runtimeDir};${process.env.PATH ?? ''}`,
  }
  if (process.env.DSH_HOME === undefined || process.env.DSH_HOME.trim() === '') env.DSH_HOME = options.dshHome
  if (process.env.DSH_TELEMETRY_DISABLED === undefined) env.DSH_TELEMETRY_DISABLED = '1'
  // 内置技能根：skill-filesystem 的 bundled 层（rank 600），随应用分发、不进技能管理页。
  if (options.bundledSkillDir !== undefined && process.env.DSH_BUNDLED_SKILL_DIR === undefined) {
    env.DSH_BUNDLED_SKILL_DIR = options.bundledSkillDir
  }
  return env
}

/**
 * 起 dsh 常驻子进程（RunAsNode trampoline）+ 解析端口 + 落日志。
 * @param options - dshBin/bcPatch/childEnv/clearEnvUrl/logFile/runAsNode。
 * @returns 子进程句柄 + 端口 promise + 日志 sink。
 */
export function spawnDshWeb(options) {
  const sink = createLogSink({ logFile: options.logFile })
  const port = scanPort(sink)
  mkdirSafe(dirname(options.logFile))
  const nodePrefix = options.runAsNode ? ['--expose-internals', '--import', options.clearEnvUrl] : []
  const child = spawn(
    process.execPath,
    [
      ...nodePrefix,
      options.dshBin,
      'web', '--patch', options.bcPatch, '--host', '127.0.0.1', '--port', '0',
    ],
    { env: options.childEnv, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  child.stdout.on('data', (chunk) => { sink.onData(chunk.toString()) })
  child.stderr.on('data', (chunk) => { sink.onData(chunk.toString()) })
  return { child, port, sink }
}

/** mkdir -p（suppress EEXIST）。 */
function mkdirSafe(dir) {
  try { mkdirSync(dir, { recursive: true }) } catch { /* ignore */ }
}
