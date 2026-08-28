/**
 * electron-builder 配置（P1-0，照抄参考项目 build 字段 + 品牌注入）：读
 * `branding/<name>/branding.yaml`（appId/productName/executableName 等），
 * 版本从 package.json。asarUnpack 只解包「必须物理」的项（bc 插件 tarball、
 * cordis.patch.yml、node-pty/koffi 原生、pnpm）；@deepseek-ai/dsh JS 闭包留
 * asar（Electron RunAsNode 的 fs 是 asar-aware）。NSIS：可选目录/快捷方式、
 * 卸载删 %APPDATA%/<brandId>（delete-appdata.generated.nsh 由 dist 生成）。
 *
 * 品牌是单一事实源（docs/03 §9）；本配置不含品牌字面量（S7 可扫）。
 * @module desktop/electron-builder.config
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { readBranding, repoBrandingYaml, REPO_ROOT, DESKTOP_DIR } from './src/branding.mjs'

// dist 编排注入 BC_BRAND_DIR（branding/<name> 目录）；缺省默认品牌。
const brandDir = process.env.BC_BRAND_DIR
const branding = readBranding(brandDir ? join(brandDir, 'branding.yaml') : repoBrandingYaml(REPO_ROOT))
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

/** NSIS 卸载时删除 %APPDATA%/<brandId> 的 include（dist 生成，含 brandId）。 */
const generatedNsh = join(DESKTOP_DIR, 'build', 'delete-appdata.generated.nsh')

export default {
  appId: branding.appId,
  productName: branding.productName,
  // staging 物化的是 production 依赖（electron 是 devDep 不在其中），显式钉版本。
  electronVersion: '43.4.0',
  asar: true,
  asarUnpack: [
    // bc 插件 tarball / patch / branding：pnpm 与子进程只读物理路径。
    'resources/**',
    // 整个依赖树物理（照抄参考项目）：dsh-app-boot 的 profile fallback
    //（healProfilesModuleFallback）需把 INSTALL_ANCHOR 指向物理 node_modules
    // 建 junction；依赖留在 asar 内会让 import.meta.url 是 asar 虚拟路径、
    // fallback junction 指向 app.asar 文件而失效（packaged 冒烟踩坑）。
    'node_modules/**',
  ],
  afterPack: join(DESKTOP_DIR, 'scripts', 'after-pack.mjs'),
  electronFuses: { runAsNode: true },
  npmRebuild: false,
  directories: { output: 'dist', buildResources: 'build' },
  files: [
    'electron/**',
    'src/**',
    'resources/**',
    'build/icon.ico',
    'build/tray-icon.png',
    'package.json',
    '!node_modules/electron/**',
    '!node_modules/electron-builder/**',
    '!node_modules/app-builder-lib/**',
    '!node_modules/@types/**',
    '!node_modules/**/*.md',
  ],
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: join(DESKTOP_DIR, 'build', 'icon.ico'),
    signExecutable: false,
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: branding.productName,
    // `arch`/`ext` 是 electron-builder 的宏（JS 配置里不能作为 JS 模板变量求值，
    // 用字符串字面量保留给 electron-builder 运行时替换）。Setup 后缀对齐
    // 02-goals §4 验收名 `BC-Agent-Desktop-Setup.exe`。
    artifactName: `${branding.executableName}-${pkg.version}-${'${arch}'}-Setup.${'${ext}'}`,
    // 卸载删 %APPDATA%/<brandId>（「卸载干净」；内置 deleteAppDataOnUninstall
    // 删的是 %APPDATA%/<productName>，与运行时覆写的 brandId 目录不一致）。
    include: generatedNsh,
    deleteAppDataOnUninstall: false,
  },
}
