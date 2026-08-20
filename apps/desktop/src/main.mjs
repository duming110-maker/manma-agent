/**
 * Desktop shell — 纯 Node headless 启动器（P1-0 保留 dev 路径，无 Electron）：
 * 复用 `src/launcher.mjs` 的编排（resolveDshBin / ensurePluginsReady link 安装），
 * 直接 `spawn` dsh CLI `web` 命令，stdio inherit（终端看日志）。生产走
 * `electron/main.js`（Electron + RunAsNode trampoline + 托盘 + 端口解析）。
 *
 * 差异：纯 Node dev 无 ELECTRON_RUN_AS_NODE（不是 Electron 二进制），环境里
 * 也不设该变量；spike 数据落 `apps/desktop/.data/dsh-home`（gitignored）。
 * @module desktop/main
 */

import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { resolveDshBin, ensurePluginsReady } from './launcher.mjs'

/** 仓库根（apps/desktop/src 的上级上级上级）。 */
const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url))
/** Spike 数据根（apps/desktop/.data/dsh-home）。 */
const SPIKE_DSH_HOME = fileURLToPath(new URL('../.data/dsh-home', import.meta.url))
/** bc-agent profile 叠加 patch。 */
const BC_PATCH = join(REPO_ROOT, 'profiles', 'bc-agent', 'cordis.patch.yml')
/** 打包资源目录（dev 用仓库路径；tarball 模式 packaged 才用）。 */
const RESOURCES_DIR = fileURLToPath(new URL('../resources', import.meta.url))

/** Loopback 绑定 + 端口 0（OS 分配）。 */
const HOST = '127.0.0.1'
const PORT = '0'

/** 主流程：build 插件（link）→ spawn dsh web，stdout 直接透传终端。 */
export function runHost() {
  const dshBin = resolveDshBin()
  const env = {
    ...process.env,
    ...(process.env.DSH_HOME === undefined || process.env.DSH_HOME.trim() === ''
      ? { DSH_HOME: SPIKE_DSH_HOME }
      : {}),
    ...(process.env.DSH_TELEMETRY_DISABLED === undefined
      ? { DSH_TELEMETRY_DISABLED: '1' }
      : {}),
  }
  mkdirSync(env.DSH_HOME, { recursive: true })

  ensurePluginsReady({
    mode: 'link',
    dshBin,
    childEnv: env,
    dshHome: env.DSH_HOME,
    repoRoot: REPO_ROOT,
    resourcesDir: RESOURCES_DIR,
    clearEnvUrl: '',
    runAsNode: false,
  })

  process.stderr.write(`desktop: dsh home ${env.DSH_HOME}\n`)
  process.stderr.write(`desktop: bc-agent patch ${BC_PATCH}\n`)

  const child = spawn(
    process.execPath,
    [dshBin, 'web', '--patch', BC_PATCH, '--host', HOST, '--port', PORT],
    { stdio: 'inherit', env },
  )
  const forward = (signal) => { if (!child.killed) child.kill(signal) }
  process.on('SIGINT', () => { forward('SIGINT') })
  process.on('SIGTERM', () => { forward('SIGTERM') })
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal === null ? 1 : 128)
  })
}

runHost()
