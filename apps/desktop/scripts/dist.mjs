/**
 * `pnpm run dist` 编排（P1-0）：解析品牌 → 生成图标 → 编译 branding.json →
 * 打包 bc 插件 tarball → 生成卸载 nsh → electron-builder（NSIS）→ 验证产物。
 *
 * 用法：`pnpm run dist -- --brand branding/default`（缺省默认品牌）。
 * 产物：`apps/desktop/dist/<executableName>-<version>-x64-Setup.exe`。
 *
 * 变更履历：
 * - 2026-08-31 下载镜像 fallback：补 ELECTRON_MIRROR（Electron zip 此前走默认
 *   GitHub 直连，缓存未命中时超时失败）；builder 工具镜像改为尊重调用方已有配置。
 * @module desktop/scripts/dist
 */

import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DESKTOP_DIR, REPO_ROOT, readBranding } from '../src/branding.mjs'
import { generateIcons } from './generate-icons.mjs'
import { packPlugins } from './pack-plugins.mjs'
import { materializeDeps } from './materialize-deps.mjs'
import { verifyInstaller } from './verify-installer.mjs'

/** 解析 `--brand <dir>` 参数（相对仓库根；缺省 branding/default）。 */
function resolveBrandDir(argv) {
  const index = argv.indexOf('--brand')
  const name = index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : 'branding/default'
  return join(REPO_ROOT, name)
}

/** 生成卸载用 NSIS include（brandId 注入；卸载删 %APPDATA%/<brandId>）。 */
function writeUninstallNsh(buildDir, brandId) {
  const content = [
    '; 卸载时删除 %APPDATA%/<brandId>（「卸载干净」；由 dist 按品牌生成）。',
    '!macro customUnInstall',
    `  RMDir /r "$APPDATA\\${brandId}"`,
    '!macroend',
    '',
  ].join('\r\n')
  mkdirSync(buildDir, { recursive: true })
  writeFileSync(join(buildDir, 'delete-appdata.generated.nsh'), content, 'utf8')
}

/** 编译 branding.json（Electron main 运行时 loadBranding 读；asarUnpack 物理）。 */
function writeBrandingJson(resourcesDir, brandYaml) {
  const branding = readBranding(brandYaml)
  mkdirSync(resourcesDir, { recursive: true })
  writeFileSync(join(resourcesDir, 'branding.json'), JSON.stringify(branding, null, 2), 'utf8')
}

/** 主流程。 */
export async function dist(argv) {
  const brandDir = resolveBrandDir(argv)
  const brandYaml = join(brandDir, 'branding.yaml')
  const resourcesDir = join(DESKTOP_DIR, 'resources')
  const buildDir = join(DESKTOP_DIR, 'build')
  const env = {
    ...process.env,
    BC_BRAND_DIR: brandDir,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    // Electron zip 与 builder 工具（winCodeSign/rcedit 等）默认从 GitHub Releases
    // 下载，直连常超时（2026-08-31 打包实测：ETIMEDOUT github.com:443）。
    // 仅在调用方未指定时注入 npmmirror 镜像 fallback，已有自定义镜像配置则尊重之。
    ELECTRON_MIRROR: process.env.ELECTRON_MIRROR ?? 'https://npmmirror.com/mirrors/electron/',
    ELECTRON_BUILDER_BINARIES_MIRROR:
      process.env.ELECTRON_BUILDER_BINARIES_MIRROR ?? 'https://npmmirror.com/mirrors/electron-builder-binaries/',
    // 让 electron-builder 的 packageManager 环境检测命中 pnpm → 用 pnpm
    // collector（保留 .pnpm 多版本嵌套，避免 npm collector 漏收集/版本冲突）。
    npm_config_user_agent: 'pnpm/11.7.0 npm/? node/v24 pnpm/11.7.0',
    npm_execpath: join(DESKTOP_DIR, 'node_modules', '.bin', 'pnpm.cjs'),
  }

  const branding = readBranding(brandYaml)
  console.log(`-> dist brand: ${branding.brandId} (${brandDir})`)

  writeBrandingJson(resourcesDir, brandYaml)
  writeUninstallNsh(buildDir, branding.brandId)
  await generateIcons({ brandYaml })
  packPlugins({ brandDir })

  // 直接跑 electron-builder 的 JS 入口（Windows 下 .bin shim 不在 PATH，node 跑最稳）。
  // 依赖收集走 pnpm collector（env npm_config_user_agent 触发）：保留 .pnpm
  // 多版本嵌套，npm collector 会漏收集虚拟根/platform 包且扁平化版本冲突。
  const builderCli = join(DESKTOP_DIR, 'node_modules', 'electron-builder', 'cli.js')
  const builder = spawnSync(
    process.execPath,
    [
      builderCli,
      '--win', 'nsis', '--x64', '--publish', 'never',
      '--config', 'electron-builder.config.mjs',
      '--config.npmRebuild=false',
      '--config.win.signExecutable=false',
    ],
    { cwd: DESKTOP_DIR, env, stdio: 'inherit' },
  )
  if (builder.status !== 0) throw new Error(`dist: electron-builder failed (exit ${String(builder.status)})`)

  verifyInstaller()
  console.log('-> dist complete')
}

/** CLI 入口：`node scripts/dist.mjs [--brand branding/<name>]`。 */
dist(process.argv.slice(2)).catch((error) => {
  console.error('dist failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
