/**
 * 私有运行时 shim 生成（P1-0，照抄参考项目 desktop-runtime-environment.ts 的
 * Windows shim 格式）：在 userData 下写 `clear-env.mjs` + `node.cmd` +
 * `pnpm.cmd`，让打包后的应用不污染系统 PATH 也能跑 pnpm（dsh plugin 是 pnpm
 * 转发器，spawnSync('pnpm', {shell:true}) 经 PATH 解析）。
 *
 * 核心纪律（05-references §4.8 / ELECTRON_RUN_AS_NODE trampoline）：
 * - 所有 Node 子进程复用 Electron 二进制（process.execPath），进程内设
 *   ELECTRON_RUN_AS_NODE=1；
 * - 加载 dsh CLI 用 `--expose-internals`（dsh CLI 需要 Node internals）；
 * - pnpm 的 npm_config_* 指向 Electron 头（原生模块在 Electron 下解析）。
 *
 * 变更履历：
 * - 2026-08-31 clear-env.mjs 不再删除 ELECTRON_RUN_AS_NODE：上游目录选择
 *   worker 依赖它以 Node 模式自 spawn（删除致 worker 退化为第二个 GUI 实例、
 *   撞单实例锁静默退出）；详见 clearEnvironmentModule 注释。
 * @module desktop/electron/shims
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const RUN_AS_NODE = 'ELECTRON_RUN_AS_NODE'
const ELECTRON_HEADERS_URL = 'https://electronjs.org/headers'

/** batch 引号包裹（值不得含引号/换行；% 转义为 %%）。 */
function quoteBatchWord(value) {
  if (/["\r\n]/u.test(value)) throw new Error('desktop shim: batch arg must not contain quotes or newlines')
  return `"${value.replaceAll('%', '%%')}"`
}

/** batch set 值（同上，无引号包裹）。 */
function escapeBatchSetValue(value) {
  if (/["\r\n]/u.test(value)) throw new Error('desktop shim: batch env value must not contain quotes or newlines')
  return value.replaceAll('%', '%%')
}

/**
 * clear-env.mjs 内容（各子进程进 JS 入口前 `--import` 预载执行）。
 *
 * 2026-08-31 两项职责（本文件是 bc 在 dsh 进程内的唯一合法注入点）：
 * 1. **不再删除** `ELECTRON_RUN_AS_NODE`：上游组件以 `process.execPath` 自
 *    spawn 并继承 `{...process.env}`，依赖该变量让 Electron 二进制以 Node
 *    模式运行；删除会使其退化成第二个 GUI 实例（撞单实例锁静默退出）。
 * 2. **execPath 重定向**：若应用旁存在随包分发的真实 node.exe（dist 拷入
 *    `<exe>/resources/runtime/node.exe`），把 `process.execPath` 指过去——
 *    上游全部"execPath 自 spawn"随之落在真实 Node 上。否则 win32 目录选择
 *    worker 的 koffi 绑定在 Electron 运行时（abi 148）的 napi 层崩溃
 *    （FATAL napi_get_last_error_info），表现为选目录报
 *    "worker exited before reporting a result"。文件不存在则维持原值
 *    （dev 形态本就是真 node）。
 */
function clearEnvironmentModule() {
  return [
    `import { existsSync } from 'node:fs'`,
    `import { join } from 'node:path'`,
    ``,
    `// 真 node.exe 随包分发（dist 拷入）；本应用二进制与 resources/ 同级。`,
    `const bundledNode = join(process.execPath, '..', 'resources', 'runtime', 'node.exe')`,
    `if (existsSync(bundledNode)) {`,
    `  // process.execPath 是 writable: false 的数据属性（普通赋值静默失败），`,
    `  // 但 configurable: true，须用 defineProperty 强制重写。`,
    `  Object.defineProperty(process, 'execPath', { value: bundledNode, writable: true, configurable: true, enumerable: true })`,
    `}`,
    ``,
    `// ELECTRON_RUN_AS_NODE 刻意保留：上游 execPath 自 spawn 的子进程依赖它`,
    `// 以 Node 模式运行；真 node 忽略该变量，故不清洗会话 shell 环境。`,
    '',
  ].join('\n')
}

/** Windows node.cmd（仅供 pnpm 生命周期脚本；设 RUN_AS_NODE 后跑 Electron）。 */
function windowsNodeShim(appExecutable, clearEnvironmentUrl) {
  return [
    '@echo off',
    'setlocal DisableDelayedExpansion',
    `set "${RUN_AS_NODE}=1"`,
    `${quoteBatchWord(appExecutable)} --import ${quoteBatchWord(clearEnvironmentUrl)} %*`,
    'exit /b %errorlevel%',
    '',
  ].join('\r\n')
}

/** Windows pnpm.cmd（PATH 上的 pnpm；优先用随包分发的真 node.exe 跑 pnpm）。 */
function windowsPnpmShim(
  nodeExecutable,
  nodeBinDir,
  nodeShimPath,
  pnpmBinPath,
  electronVersion,
) {
  return [
    '@echo off',
    'setlocal DisableDelayedExpansion',
    `set "PATH=${escapeBatchSetValue(nodeBinDir)};%PATH%"`,
    `set "NODE=${escapeBatchSetValue(nodeShimPath)}"`,
    `set "${RUN_AS_NODE}=1"`,
    'set "npm_config_runtime=electron"',
    `set "npm_config_target=${escapeBatchSetValue(electronVersion)}"`,
    `set "npm_config_disturl=${ELECTRON_HEADERS_URL}"`,
    `${quoteBatchWord(nodeExecutable)} ${quoteBatchWord(pnpmBinPath)} %*`,
    'exit /b %errorlevel%',
    '',
  ].join('\r\n')
}

/**
 * 生成私有运行时 shim（幂等：已存在则跳过；原子写）。返回运行需要的路径。
 * @param options - 生成参数。
 * @returns shim 目录/文件路径集。
 */
export function writeRuntimeShims(options) {
  const runtimeDir = join(options.userDataDir, 'runtime')
  const clearEnvPath = join(runtimeDir, 'clear-env.mjs')
  const nodeShimPath = join(runtimeDir, 'node.cmd')
  const pnpmShimPath = join(runtimeDir, 'pnpm.cmd')
  mkdirSync(runtimeDir, { recursive: true })

  const clearEnvUrl = pathToFileURL(clearEnvPath).href
  writeFileSync(clearEnvPath, clearEnvironmentModule(), { encoding: 'utf8' })
  writeFileSync(nodeShimPath, windowsNodeShim(options.appExecutable, clearEnvUrl), { encoding: 'utf8' })
  // pnpm 用真 node 跑（options.nodeExecutable 存在时；否则回退 Electron 二进制）：
  // pnpm 11 的 store 索引用 SQLite，Electron-as-node 运行时行为不可控，曾致
  // packaged 首启 `dsh plugin add` 失败（实体已落、bundle 未注册，次启「装上了
  // 但不加载」）。真 node 下 SQLite/原生模块/子进程全部走标准 Node 语义。
  writeFileSync(
    pnpmShimPath,
    windowsPnpmShim(
      options.nodeExecutable ?? options.appExecutable,
      runtimeDir,
      nodeShimPath,
      options.pnpmBinPath,
      options.electronVersion,
    ),
    { encoding: 'utf8' },
  )

  return { runtimeDir, clearEnvPath, clearEnvUrl, nodeShimPath, pnpmShimPath, nodeBinDir: runtimeDir }
}
