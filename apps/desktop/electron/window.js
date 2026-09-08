/**
 * BrowserWindow 工厂 + 安全策略（05-references §4.8 纪律）：contextIsolation +
 * sandbox + 无 Node 集成 + 无 preload bridge；同源导航校验（只放行 loopback
 * 源，外链转系统浏览器）；窗口 close 默认隐藏（托盘常驻，托盘提供恢复/退出）。
 * 应用级退出（before-quit）置 isQuitting，close 时放行——否则托盘「退出」
 * 触发 app.quit() 会被 close 的 preventDefault 吞掉，表现为退出无效。
 * @module desktop/electron/window
 */

import { BrowserWindow, shell } from 'electron'

/** 当前应用的 loopback 源（启动时锚定，供导航校验）。 */
let allowedOrigin = ''

/** 应用是否正在退出（before-quit 置位；close 据此放行真正关闭）。 */
let isQuitting = false

/**
 * 标记应用退出中（供 close 处理器放行）。由调用方在 app 'before-quit' 时调用。
 */
export function markQuitting() {
  isQuitting = true
}

/**
 * 创建主窗口并加载 dsh URL。
 * @param options - 窗口配置。
 * @returns BrowserWindow 实例。
 */
export function createMainWindow(options) {
  const window = new BrowserWindow({
    title: options.title,
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
    },
  })

  // 锚定同源：仅放行当前 loopback 源。
  allowedOrigin = new URL(options.url).origin

  // ready-to-show 后再显示，避免白屏闪烁。
  window.once('ready-to-show', () => { window.show() })

  // 同源导航校验：非本 origin 的 frame/redirect 一律阻止。
  window.webContents.on('will-frame-navigate', (event, url) => {
    if (new URL(url).origin !== allowedOrigin) event.preventDefault()
  })
  window.webContents.on('will-redirect', (event, url) => {
    if (new URL(url).origin !== allowedOrigin) event.preventDefault()
  })
  // 新窗口（target=_blank / window.open）：外链走系统浏览器，其余拒绝。
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/u.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // close 默认隐藏（托盘常驻）；应用级退出（isQuitting）时放行真正关闭。
  window.on('close', (event) => {
    if (!isQuitting && !window.isDestroyed()) {
      event.preventDefault()
      window.hide()
      options.onClose()
    }
  })

  void window.loadURL(options.url)
  return window
}
