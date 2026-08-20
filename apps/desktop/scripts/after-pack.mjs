/**
 * electron-builder afterPack 钩子（P1-0）：打包后、签名前断言关键条目都在——
 * bc 插件 tarball / cordis.patch.yml / branding.json（物理 unpacked）、node-pty
 * 实际 prebuilds 集（ConPTY-only，无 winpty）、koffi native。缺失即抛错拒绝
 * 产出（照抄参考项目 verify-packaged-runtime.ts 的门禁思路，按本方案裁剪）。
 * @module desktop/scripts/after-pack
 */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DESKTOP_DIR } from '../src/branding.mjs'

/**
 * dsh 闭包的 platform-specific 原生/预编译包：electron-builder 的 npm collector
 * 会漏收集这些「被 dsh 包的 optionalDependencies 引用」的纯平台包（koffi native
 * 在 @koromix/koffi-win32-x64、sharp native 在 @img/sharp-win32-x64 等），
 * 而 dsh 的 fs/session 持久化与附件处理依赖它们——打包后整目录复制进 unpacked。
 */
const PLATFORM_PACKAGES = [
  '@koromix/koffi-win32-x64',
  '@img/sharp-win32-x64',
  '@vscode/ripgrep',
]

/** 必须在 app.asar.unpacked 内的关键条目（子进程/pnpm 只读物理路径）。 */
function requiredUnpacked(unpackedDir) {
  const pluginsDir = join(unpackedDir, 'resources', 'plugins')
  const prebuilds = join(unpackedDir, 'node_modules', 'node-pty', 'prebuilds', 'win32-x64')
  return [
    ['resources/cordis.patch.yml', join(unpackedDir, 'resources', 'cordis.patch.yml')],
    ['resources/branding.json', join(unpackedDir, 'resources', 'branding.json')],
    ['resources/plugins/*.tgz', pluginsDir],
    ['node-pty prebuild conpty.node', join(prebuilds, 'conpty.node')],
    ['node-pty prebuild conpty_console_list.node', join(prebuilds, 'conpty_console_list.node')],
    ['node-pty prebuild conpty/OpenConsole.exe', join(prebuilds, 'conpty', 'OpenConsole.exe')],
    ['node-pty prebuild conpty/conpty.dll', join(prebuilds, 'conpty', 'conpty.dll')],
  ]
}

/**
 * afterPack 钩子。
 * @param context - electron-builder context（appOutDir 指向打包后的 app 目录）。
 */
export default async function afterPack(context) {
  const { appOutDir } = context
  // electron-builder 的 appOutDir = win-unpacked 根；app.asar.unpacked 在其
  // resources/ 子目录（与 app.asar 并列）。
  const unpackedDir = join(appOutDir, 'resources', 'app.asar.unpacked')

  for (const [label, path] of requiredUnpacked(unpackedDir)) {
    if (label.endsWith('*.tgz')) {
      const files = existsSync(path) ? readdirSync(path).filter(file => file.endsWith('.tgz')) : []
      if (files.length === 0) throw new Error(`afterPack: missing ${label} under ${path}`)
      continue
    }
    if (!existsSync(path)) throw new Error(`afterPack: missing ${label} (${path})`)
  }

  for (const pkg of PLATFORM_PACKAGES) {
    const segments = pkg.split('/')
    const source = join(DESKTOP_DIR, 'node_modules', ...segments)
    const target = join(unpackedDir, 'node_modules', ...segments)
    if (existsSync(source)) {
      // electron-builder 可能已收集（symlink 到 pnpm store）或上次复制残留；
      // 先删目标再复制。dereference 跟随仓库里的 symlink（apps/desktop/node_modules
      // 指向 pnpm store）复制真实文件——Windows 建 symlink 需权限（EPERM）。
      rmSync(target, { recursive: true, force: true })
      mkdirSync(join(target, '..'), { recursive: true })
      cpSync(source, target, { recursive: true, dereference: true })
      process.stderr.write(`desktop: afterPack copied platform pkg ${pkg}\n`)
    }
  }

  // 顶层 @deepseek-ai 显式依赖全量复制（electron-builder 可能漏收集 optional/peer
  // 引用的成员，如 dsh-session-stats / dsh-client-ui-input-trigger）；覆盖已收集
  // 的同名包（同内容，dereference 真实文件）。
  const desktopDeepseek = join(DESKTOP_DIR, 'node_modules', '@deepseek-ai')
  if (existsSync(desktopDeepseek)) {
    for (const name of readdirSync(desktopDeepseek)) {
      const source = join(desktopDeepseek, name)
      const target = join(unpackedDir, 'node_modules', '@deepseek-ai', name)
      rmSync(target, { recursive: true, force: true })
      mkdirSync(join(target, '..'), { recursive: true })
      cpSync(source, target, { recursive: true, dereference: true })
    }
    process.stderr.write(`desktop: afterPack copied @deepseek-ai top-level deps\n`)
  }

  process.stderr.write('desktop: afterPack assertions PASS\n')
}
