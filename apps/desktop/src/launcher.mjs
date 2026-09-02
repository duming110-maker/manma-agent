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
 *
 * 变更履历：
 * - 2026-08-31 修复安装路径含空格时 `dsh plugin add` 失败（exit -4058）：上游
 *   Windows 转发 pnpm 用 `shell: true` 裸拼参数，tarball spec 被空格拆断；现
 *   tarball 模式先物理拷到无空格 staging（`stagingDir`，= userData/runtime/plugins）
 *   再安装。
 * - 2026-09-01 修复 packaged 重打包后插件不更新：0.1.0 版本号跨构建不变，但
 *   每次 `dist` 出的 tarball 字节不同，旧的「marker 存在即跳过」让 exe 永远用
 *   首次安装的旧插件（典型症状：dev 的「打开」按钮可用、exe 不生效）。现改为
 *   对 tarball 做 sha256 内容指纹，指纹不匹配即自动重装；staging 拷贝也改为按
 *   内容指纹判定，保证安装的是最新字节。
 * - 2026-09-02 修复 `--force` 仍不落地：指纹重装走的 `dsh plugin add --force`
 *   （= pnpm add file:tarball --force）在 hoisted 布局下对同版本 tarball 内容变化
 *   只刷新 lockfile/.modules.yaml/.pnpm 元数据，不覆盖 node_modules 实体目录，
 *   导致 exe 里编辑器「打开」点后无反应（dev 正常）。重装前先删旧包实体目录，
 *   强制 pnpm 重新解包落地。
 * - 2026-09-02 修复指纹比对前导斜杠：tarball 侧切片用 `package/lib`（无尾斜杠）
 *   得到 `/client.js`，installed 侧 walk 得到 `client.js`，两侧口径不一致导致
 *   「已装最新」永远判 false——packaged 每次启动都删目录重装、装完仍抛
 *   "lib content still stale after install"（启动即弹错）。前缀改 `package/lib/`。
 * @module desktop/src/launcher
 */

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { gunzipSync } from 'node:zlib'
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

/** pnpm pack 的 tarball 顶层固定为 `package/`，库产物都在 `package/lib/`。
 * 含尾部斜杠：切片后相对路径与 installedLibFingerprint 的 walk 口径一致
 *（无前导斜杠；用 `package/lib` 会切出 `/client.js`，指纹永远不相等——
 * 2026-09-02 packaged 启动即报 "lib content still stale after install" 的根因）。 */
const PACK_LIB_PREFIX = 'package/lib/'

/** profile 里已安装的幂等标记路径。 */
export function pluginInstalledMarker(dshHome, scopeName) {
  return join(dshHome, 'profiles', 'web', 'node_modules', scopeName, 'package.json')
}

/** 内容指纹 = tarball 的升级身份：0.1.0 版本号跨构建不变，但每次 `dist` 出的
 * 字节可能不同，所以「已装最新」必须按内容哈希判定，而非 marker 的单纯存在。 */
function tarballFingerprint(filePath) {
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return hash.digest('hex')
}

/** 从 gz+tar 的 512 字节块头里读一个定长字段（NUL 结尾字符串）。 */
function tarString(buf, start, len) {
  let end = start
  while (end < start + len && buf[end] !== 0) end++
  return buf.subarray(start, end).toString('utf8')
}

/**
 * 求 gz+tar 包内 `prefix` 目录下所有普通文件的规范摘要（相对路径升序 + 长度 + 字节）。
 * 作为「已装实体内容 == tarball 内容」的直接校验依据——取代会被 pnpm hoisted 布局
 * 污染的独立指纹文件。
 */
function tarballDirFingerprint(spec, prefix) {
  const tar = gunzipSync(readFileSync(spec))
  const hash = createHash('sha256')
  const entries = []
  let offset = 0
  while (offset + 512 <= tar.length) {
    const block = tar.subarray(offset, offset + 512)
    if (block.every(byte => byte === 0)) break // 归档结束：两段全零块
    const name = tarString(block, 0, 100)
    const sizeText = tarString(block, 124, 12).replace(/\0+$/, '').trim()
    const size = parseInt(sizeText || '0', 8) || 0
    const typeflag = String.fromCharCode(block[156])
    if ((typeflag === '0' || typeflag === '\0') && name.startsWith(prefix) && name.length > prefix.length) {
      entries.push({ rel: name.slice(prefix.length), data: tar.subarray(offset + 512, offset + 512 + size) })
    }
    offset += 512 + Math.ceil(size / 512) * 512
  }
  entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  for (const e of entries) {
    hash.update(e.rel); hash.update('\0')
    hash.update(String(e.data.length)); hash.update('\0')
    hash.update(e.data)
  }
  return hash.digest('hex')
}

/** 已装包 `lib/` 目录的规范摘要（与 tarballDirFingerprint 同口径）；无 lib 返回 undefined。 */
function installedLibFingerprint(pkgDir) {
  const root = join(pkgDir, 'lib')
  if (!existsSync(root)) return undefined
  const hash = createHash('sha256')
  const files = []
  const walk = (dir, rel) => {
    const entries = readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    for (const e of entries) {
      const p = join(dir, e.name)
      const r = rel === '' ? e.name : `${rel}/${e.name}`
      if (e.isDirectory()) walk(p, r)
      else if (e.isFile()) files.push({ rel: r, data: readFileSync(p) })
    }
  }
  walk(root, '')
  for (const f of files) {
    hash.update(f.rel); hash.update('\0')
    hash.update(String(f.data.length)); hash.update('\0')
    hash.update(f.data)
  }
  return hash.digest('hex')
}

/**
 * 组装 bc 插件安装描述。
 * @param options - `mode`（link/tarball）+ `repoRoot`（dev link 用）+
 *   `resourcesDir`（packaged）+ `stagingDir`（packaged 必传：tarball 无空格中转目录）。
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
    const source = join(dir, tarball)
    // 内容指纹 = 升级身份：0.1.0 版本号不变，但每次 dist 出的字节可能不同；用
    // 哈希（而非 marker 存在性）判定「是否已装最新」，否则重打包后 exe 永远用旧插件。
    const fingerprint = tarballFingerprint(source)
    // 上游 `dsh plugin add` 在 Windows 经 `spawnSync('pnpm', args, {shell: true})`
    // 转发，参数裸拼接、无引号防护：安装路径含空格（如自选 `D:\Program Files\...`）
    // 会把 tarball spec 拆断 → pnpm ENOENT（exit -4058）。规避：先把 tarball 物理拷
    // 到无空格的 staging（userData/runtime/plugins，brandId 为 kebab-case）再安装。
    // 按内容指纹（非 size）判定 staging 是否已就位，确保安装的就是最新字节。
    let spec = source
    if (options.stagingDir !== undefined) {
      mkdirSync(options.stagingDir, { recursive: true })
      const target = join(options.stagingDir, tarball)
      if (!existsSync(target) || tarballFingerprint(target) !== fingerprint) {
        cpSync(source, target)
      }
      spec = target
    }
    return { name: plugin.name, scopeName: plugin.scopeName, spec, fingerprint }
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
  const plugins = bcPluginSpecs({
    mode: options.mode,
    repoRoot: options.repoRoot,
    resourcesDir: options.resourcesDir,
    stagingDir: options.stagingDir,
  })
  const nodePrefix = options.runAsNode ? ['--expose-internals', '--import', options.clearEnvUrl] : []
  const profileNodeModules = join(options.dshHome, 'profiles', 'web', 'node_modules')
  for (const plugin of plugins) {
    const marker = pluginInstalledMarker(options.dshHome, plugin.scopeName)
    const pkgDir = join(profileNodeModules, ...plugin.scopeName.split('/'))
    let wasInstalled = false

    if (options.mode === 'link') {
      ensurePluginBuilt(plugin, options.childEnv)
      if (existsSync(marker)) continue
    } else {
      // tarball 模式：直接比对「已装 lib/ 实体内容」与「tarball lib/ 内容」，一致才跳过。
      // 取代旧的 marker/指纹文件判定——pnpm hoisted 布局对同版本 file: tarball 内容变化
      // 只刷新元数据不落地实体，独立指纹文件会「显示最新、实体陈旧」（poisoned state），
      // 导致 dev「打开」正常而 exe 无效。内容比对直接看实体，陈旧即删目录强制重装（自愈）。
      const expected = tarballDirFingerprint(plugin.spec, PACK_LIB_PREFIX)
      const actual = installedLibFingerprint(pkgDir)
      if (actual !== undefined && actual === expected) continue
      wasInstalled = actual !== undefined
      if (wasInstalled) rmSync(pkgDir, { recursive: true, force: true })
    }

    const addArgs = ['plugin', '--profile', 'web', 'add', plugin.spec]
    // 同一 0.1.0 版本号下 pnpm 可能命中缓存、不重读本地 tarball 内容：已装过的补 --force。
    if (wasInstalled) addArgs.push('--force')
    process.stderr.write(`desktop: installing ${plugin.scopeName} into the 'web' profile (${options.mode})\n`)
    const result = spawnSync(
      process.execPath,
      [...nodePrefix, options.dshBin, ...addArgs],
      { env: options.childEnv, stdio: 'inherit' },
    )
    if (result.status !== 0) throw new Error(`desktop: dsh plugin add failed for ${plugin.scopeName} (exit ${String(result.status)})`)
    if (!existsSync(marker)) throw new Error(`desktop: ${plugin.scopeName} still unresolvable after install (${marker})`)
    if (options.mode === 'tarball') {
      const after = installedLibFingerprint(pkgDir)
      if (after !== tarballDirFingerprint(plugin.spec, PACK_LIB_PREFIX)) {
        throw new Error(`desktop: ${plugin.scopeName} lib content still stale after install`)
      }
    }
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
