/**
 * 私有运行时 shim 生成（P1-0，照抄参考项目 desktop-runtime-environment.ts 的
 * Windows shim 格式）：在 userData 下写 `clear-env.mjs` + `node.cmd` +
 * `pnpm.cmd`，让打包后的应用不污染系统 PATH 也能跑 pnpm（dsh plugin 是 pnpm
 * 转发器，spawnSync('pnpm', {shell:true}) 经 PATH 解析）。
 *
 * 核心纪律（05-references §4.8 / ELECTRON_RUN_AS_NODE trampoline）：
 * - 所有 Node 子进程复用 Electron 二进制（process.execPath），进程内设
 *   ELECTRON_RUN_AS_NODE=1；
 * - `--import clear-env.mjs` 预加载模块在进真正 JS 入口前删除该变量，防泄漏
 *   到 dsh 派生的 pwsh/bash（否则它们会以 Electron-as-node 解释）；
 * - 加载 dsh CLI 用 `--expose-internals`（dsh CLI 需要 Node internals）；
 * - pnpm 的 npm_config_* 指向 Electron 头（原生模块在 Electron 下解析）。
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
 * clear-env.mjs 内容：遍历 env 删除 ELECTRON_RUN_AS_NODE（各子进程进 JS
 * 入口前 `--import` 预载执行）。
 */
function clearEnvironmentModule() {
  return [
    `for (const name of Object.keys(process.env)) {`,
    `  if (name.toUpperCase() === '${RUN_AS_NODE}') delete process.env[name]`,
    '}',
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

/** Windows pnpm.cmd（PATH 上的 pnpm；设 RUN_AS_NODE + npm_config_* 后跑 pnpm）。 */
function windowsPnpmShim(
  appExecutable,
  nodeBinDir,
  nodeShimPath,
  pnpmBinPath,
  clearEnvironmentUrl,
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
    `${quoteBatchWord(appExecutable)} --import ${quoteBatchWord(clearEnvironmentUrl)} ${quoteBatchWord(pnpmBinPath)} %*`,
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
  writeFileSync(
    pnpmShimPath,
    windowsPnpmShim(
      options.appExecutable,
      runtimeDir,
      nodeShimPath,
      options.pnpmBinPath,
      clearEnvUrl,
      options.electronVersion,
    ),
    { encoding: 'utf8' },
  )

  return { runtimeDir, clearEnvPath, clearEnvUrl, nodeShimPath, pnpmShimPath, nodeBinDir: runtimeDir }
}
