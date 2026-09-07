/**
 * bc 插件构建 + 打包 tarball（P0-5 §4.3 分发形态）：对 web-ui / capability-core
 * 走 `pnpm --filter <pkg> run build`（env 带 BC_BRAND_DIR 品牌化），再
 * `pnpm pack` 出 tgz 到 `apps/desktop/resources/plugins/`；并把
 * `profiles/bc-agent/cordis.patch.yml` 拷为 `resources/cordis.patch.yml`。
 * tarball 随 Electron 资源分发，packaged 首启 `dsh plugin add` 安装。
 * @module desktop/scripts/pack-plugins
 */

import { spawnSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { createRequire } from 'node:module'
import { DESKTOP_DIR, REPO_ROOT } from '../src/branding.mjs'

/** bc 插件清单（与 launcher 的 BC_PLUGINS 对应）。 */
const PLUGINS = ['@bc-agent/web-ui', '@bc-agent/capability-core', '@bc-agent/file-open']

/** 外部 npm 插件清单（从 node_modules 中打包出 tgz 并随 Electron 分发）。 */
const EXTERNAL_PLUGINS = ['dsh-better-sidebar']

/** 是否 Windows（pnpm 需 .cmd）。 */
const shell = process.platform === 'win32'

/**
 * 打包 bc 插件与外部插件 tarball 到 resources/plugins/ 并拷 patch。
 * @param options - brandDir（BC_BRAND_DIR，web-ui 品牌化构建）。
 */
export function packPlugins(options) {
  const resourcesDir = join(DESKTOP_DIR, 'resources')
  const pluginsDir = join(resourcesDir, 'plugins')
  // 清旧 tarball（重打包不留版本堆积）。
  rmSync(pluginsDir, { recursive: true, force: true })
  mkdirSync(pluginsDir, { recursive: true })
  const env = { ...process.env, ...(options.brandDir ? { BC_BRAND_DIR: options.brandDir } : {}) }

  // 1. 打包本地 monorepo packages 下的子包
  for (const pkg of PLUGINS) {
    const build = spawnSync('pnpm', ['--filter', pkg, 'run', 'build'], { cwd: REPO_ROOT, env, stdio: 'inherit', shell })
    if (build.status !== 0) throw new Error(`pack-plugins: build failed for ${pkg}`)
    const pack = spawnSync('pnpm', ['--filter', pkg, 'pack', '--pack-destination', pluginsDir], { cwd: REPO_ROOT, env, stdio: 'inherit', shell })
    if (pack.status !== 0) throw new Error(`pack-plugins: pack failed for ${pkg}`)
  }

  // 2. 将外部 npm 包打包为 tgz 输出到 pluginsDir
  const require = createRequire(import.meta.url)
  for (const extPkg of EXTERNAL_PLUGINS) {
    // 自动在 node_modules 中查找包的真实路径
    const pkgJsonPath = require.resolve(`${extPkg}/package.json`, { paths: [REPO_ROOT, DESKTOP_DIR] })
    const extPkgDir = dirname(pkgJsonPath)

    // 在外部包所在目录下打包导出 tgz
    const packExt = spawnSync('npm', ['pack', '--pack-destination', pluginsDir], { cwd: extPkgDir, env, stdio: 'inherit', shell })
    if (packExt.status !== 0) throw new Error(`pack-plugins: pack external failed for ${extPkg}`)
  }

  // cordis.patch.yml（profile 叠加，--patch 传给 dsh web）。
  copyFileSync(join(REPO_ROOT, 'profiles', 'bc-agent', 'cordis.patch.yml'), join(resourcesDir, 'cordis.patch.yml'))
  // bundled-skills/skill-creator（内置技能，DSH_BUNDLED_SKILL_DIR 指向此根）。
  rmSync(join(resourcesDir, 'bundled-skills'), { recursive: true, force: true })
  cpSync(join(DESKTOP_DIR, 'bundled-skills'), join(resourcesDir, 'bundled-skills'), { recursive: true })
  console.log(`-> plugins packed: ${readdirSync(pluginsDir).join(', ')}`)
  console.log('-> cordis.patch.yml copied to resources/')
  console.log('-> bundled-skills copied to resources/')
}