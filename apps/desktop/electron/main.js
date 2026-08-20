/**
 * Electron 主进程入口（P1-0 桌面壳）：单实例锁、per-brand userData/DSH_HOME、
 * 私有运行时 shim、以 ELECTRON_RUN_AS_NODE trampoline 起 dsh web 常驻子进程、
 * 解析端口后建窗/托盘；dsh 子进程退出 → 应用退出；启动失败 fail-loud 弹原生
 * 对话框（附最近 dsh 日志，比白屏好）。
 *
 * dev（`pnpm dev:electron`，未打包）与 packaged（app.isPackaged）共用
 * `src/launcher.mjs` 编排，仅安装形态（link vs tarball）与数据目录不同。
 * @module desktop/electron/main
 */

import { app, dialog } from 'electron'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { loadBranding, DESKTOP_DIR, REPO_ROOT } from '../src/branding.mjs'
import {
  resolveDshBin, ensurePluginsReady, buildChildEnv, spawnDshWeb,
} from '../src/launcher.mjs'
import { writeRuntimeShims } from './shims.mjs'
import { createMainWindow } from './window.js'
import { createTray } from './tray.js'

/** 端口解析超时（毫秒）：超过即判定启动失败。 */
const PORT_TIMEOUT_MS = 30_000

/** `app.asar` → `app.asar.unpacked`（打包后物理路径）：dsh 依赖闭包全解包后，
 * 子进程必须从物理路径加载 dsh CLI（import.meta.url 才物理，dsh-app-boot 的
 * profile fallback 才能把 junction 指向物理 node_modules）。 */
function unpackedAsarPath(path) {
  return path.replace('app.asar', 'app.asar.unpacked')
}

/** pnpm 的 bin 入口（apps/desktop 依赖 pnpm，electron-builder 收进包）。
 * pnpm 的 exports 不暴露 `./package.json`，故从主入口（lib/pnpm.cjs）反推包目录。 */
function resolvePnpmBin() {
  const require = createRequire(import.meta.url)
  const pnpmDir = dirname(require.resolve('pnpm'))
  return join(pnpmDir, 'bin', 'pnpm.mjs')
}

// ---- 单实例锁（一次只有一个 dsh 树）----
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win !== null) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })
  void bootstrap()
}

/** 主窗口句柄（供单实例/托盘访问）。 */
let mainWindow = undefined
function getMainWindow() {
  return mainWindow
}

/**
 * 启动编排：读品牌 → 设 userData/DSH_HOME → shim → 插件就绪 → spawn dsh →
 * 端口 → 建窗/托盘。任何失败 fail-loud。
 */
async function bootstrap() {
  try {
    const branding = loadBranding()
    const appData = app.getPath('appData')
    // per-brand userData（窗口/托盘状态）与 DSH_HOME（会话/存储/凭证）。
    const userDataDir = join(appData, branding.brandId)
    const dshHome = join(userDataDir, 'dsh-home')
    const isPackaged = app.isPackaged

    app.setName(branding.productName)
    app.setAppUserModelId(branding.appId)
    app.setPath('userData', userDataDir)

    await app.whenReady()

    // 私有运行时 shim（clear-env + node.cmd + pnpm.cmd）。
    const require = createRequire(import.meta.url)
    const electronVersion = String(process.versions.electron ?? '')
    const shims = writeRuntimeShims({
      userDataDir,
      appExecutable: process.execPath,
      electronVersion,
      pnpmBinPath: isPackaged ? unpackedAsarPath(resolvePnpmBin()) : resolvePnpmBin(),
    })

    // 打包后 dsh 依赖闭包在 app.asar.unpacked（物理）；从物理路径加载 dsh CLI
    // 让 import.meta.url 物理 → profile fallback 的 junction 指向物理 node_modules。
    const dshBin = isPackaged ? unpackedAsarPath(resolveDshBin()) : resolveDshBin()
    const childEnv = buildChildEnv({ dshHome, runtimeDir: shims.runtimeDir })

    // 资源定位：dev 用仓库路径；packaged 用物理 unpacked 资源
    //（process.resourcesPath = win-unpacked/resources，app.asar.unpacked 在其下）。
    const resourcesDir = isPackaged
      ? join(process.resourcesPath ?? '', 'app.asar.unpacked', 'resources')
      : join(DESKTOP_DIR, 'resources')
    const bcPatch = isPackaged
      ? join(resourcesDir, 'cordis.patch.yml')
      : join(REPO_ROOT, 'profiles', 'bc-agent', 'cordis.patch.yml')

    // 插件就绪（dev link / packaged tarball，幂等）。
    ensurePluginsReady({
      mode: isPackaged ? 'tarball' : 'link',
      dshBin,
      childEnv,
      dshHome,
      repoRoot: REPO_ROOT,
      resourcesDir,
      clearEnvUrl: shims.clearEnvUrl,
      runAsNode: true,
    })

    // 常驻 dsh 子进程 + 端口解析。
    const { child, port: portPromise, sink } = spawnDshWeb({
      dshBin,
      bcPatch,
      childEnv,
      clearEnvUrl: shims.clearEnvUrl,
      logFile: join(userDataDir, 'logs', 'desktop.log'),
      runAsNode: true,
    })
    child.on('exit', (code) => {
      // dsh 退出 → 应用退出（托盘常驻期间子进程崩溃也应退出）。
      app.exit(code ?? 0)
    })

    const port = await withTimeout(portPromise, PORT_TIMEOUT_MS, sink)
    const url = `http://127.0.0.1:${port}/`

    mainWindow = createMainWindow({ url, title: branding.productName, onClose: () => { /* 窗口隐藏，托盘常驻 */ } })
    createTray({ branding, onOpen: () => { mainWindow?.show() }, onQuit: () => {
      child.kill()
      app.quit()
    } })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('desktop: bootstrap failed:', error)
    dialog.showErrorBox('启动失败', `桌面应用启动失败：\n${message}\n\n请查看日志后重试。`)
    app.quit()
  }
}

/** 端口 promise 超时包装：超时后 fail-loud（附 dsh 日志尾部）。 */
function withTimeout(portPromise, timeoutMs, sink) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`dsh 服务未在 ${timeoutMs / 1000}s 内就绪。\n\n最近日志：\n${sink.tail().slice(-2000)}`))
    }, timeoutMs)
    portPromise.then(
      (port) => { clearTimeout(timer); resolve(port) },
      (error) => { clearTimeout(timer); reject(error) },
    )
  })
}
