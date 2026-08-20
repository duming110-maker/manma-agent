/**
 * 托盘（P1-0 简单版，docs/03 §8）：图标 + 菜单「打开主窗口 / 退出」；点击
 * 托盘图标切换/聚焦主窗。窗口关闭时隐藏到托盘，应用不退出。
 * @module desktop/electron/tray
 */

import { Tray, Menu, nativeImage } from 'electron'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'

/** 托盘图标路径：取第一个存在的（packaged 资源物理路径 → 仓库 build/）。 */
function trayIconPath() {
  const candidates = [
    join(process.resourcesPath ?? '', 'app.asar.unpacked', 'resources', 'tray-icon.png'),
    join(process.resourcesPath ?? '', 'tray-icon.png'),
    join(dirname(dirname(fileURLToPath(import.meta.url))), 'build', 'tray-icon.png'),
  ]
  return candidates.find(path => existsSync(path)) ?? candidates[2]
}

/**
 * 创建托盘。
 * @param options - 品牌与菜单回调。
 * @returns Tray 实例。
 */
export function createTray(options) {
  const tray = new Tray(nativeImage.createFromPath(trayIconPath()))
  tray.setToolTip(options.branding.productName)
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主窗口', click: options.onOpen },
    { type: 'separator' },
    { label: '退出', click: options.onQuit },
  ]))
  tray.on('click', options.onOpen)
  return tray
}
