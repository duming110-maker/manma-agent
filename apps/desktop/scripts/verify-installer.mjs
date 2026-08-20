/**
 * 安装包产物静态验证（P1-0，照抄参考项目 verify-win-installer.ts）：断言
 * `dist/<executableName>-<version>-x64-Setup.exe` 存在且带 PE 头（MZ + PE\0\0），
 * win-unpacked 的 exe 存在，且 asar.unpacked 里含 bc 插件 tarball。
 * @module desktop/scripts/verify-installer
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { readBranding, repoBrandingYaml, REPO_ROOT, DESKTOP_DIR } from '../src/branding.mjs'

/** 检查文件是否带 PE 可执行头。 */
function hasPeHeader(path) {
  try {
    const buf = readFileSync(path)
    if (buf.length < 64) return false
    if (buf[0] !== 0x4d || buf[1] !== 0x5a) return false // MZ
    const peOffset = buf.readUInt32LE(0x3c)
    return buf.readUInt32LE(peOffset) === 0x00004550 // PE\0\0
  } catch {
    return false
  }
}

/** 主验证流程。 */
export function verifyInstaller() {
  const branding = readBranding(repoBrandingYaml(REPO_ROOT))
  const distDir = join(DESKTOP_DIR, 'dist')
  const pkg = JSON.parse(readFileSync(join(DESKTOP_DIR, 'package.json'), 'utf8'))

  const setupCandidates = readdirSync(distDir).filter(file =>
    file.startsWith(`${branding.executableName}-${pkg.version}-`) && file.endsWith('Setup.exe'))
  if (setupCandidates.length === 0) throw new Error(`verify-installer: no Setup.exe under ${distDir}`)
  const setup = join(distDir, setupCandidates[0])
  if (!hasPeHeader(setup)) throw new Error(`verify-installer: ${setup} is not a PE executable`)

  const unpackedDir = join(distDir, 'win-unpacked')
  const exe = join(unpackedDir, `${branding.productName}.exe`)
  if (!existsSync(exe) || !hasPeHeader(exe)) throw new Error(`verify-installer: ${exe} missing or not PE`)

  const pluginsDir = join(unpackedDir, 'resources', 'app.asar.unpacked', 'resources', 'plugins')
  if (!existsSync(pluginsDir) || readdirSync(pluginsDir).filter(file => file.endsWith('.tgz')).length === 0) {
    throw new Error(`verify-installer: no plugin tarballs under ${pluginsDir}`)
  }

  console.log(`-> installer verified: ${setup}`)
}
