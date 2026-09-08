/**
 * 品牌配置读取（P1-0）：解析 `branding/<name>/branding.yaml` 的桌面壳相关项。
 *
 * 消费方：
 * - `scripts/dist.mjs` 构建期把解析结果编译进 `resources/branding.json`；
 * - Electron main 运行时读 `resources/branding.json`（打包后）或回退读仓库
 *   `branding/default/branding.yaml`（dev）；
 * - `electron-builder.config.mjs` 构建期读仓库 branding.yaml（appId/图标等）。
 *
 * 品牌值是「单一事实源」（docs/03 §9），业务代码禁止品牌字面量（S7 可扫）。
 * 解析器是 web-ui build.mjs 严格子集解析的同款思路：两层嵌套、双引号字符串
 * 或 `{ zh, en }` flow map、注释 strip——未知/畸形一律 fail-loud。
 * @module desktop/src/branding
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * 解析结果：desktop 桌面壳项 + product.name（窗口标题/品牌名）。
 * @typedef {{
 *   brandId: string,            // 数据目录标识：%APPDATA%/<brandId>/dsh-home
 *   appId: string,              // electron-builder 稳定升级身份
 *   productName: string,        // 安装目录/快捷方式/窗口/进程显示名（ASCII）
 *   executableName: string,     // 安装包文件名前缀
 *   icon: string,               // 品牌图标（PNG ≥256）相对 branding/<name>/ 路径
 *   trayIcon: string,           // 托盘图标相对路径
 *   updateUrl: string,          // 更新源 URL（P5 预留）
 *   uninstallerDeleteAppData: boolean, // 卸载时删 %APPDATA%/<brandId>
 *   nameZh: string,             // 中文产品名
 *   nameEn: string,             // 英文产品名
 * }} BcBranding
 */

/** 解析一个标量：双引号字符串或 `{ zh: "...", en: "..." }` flow map。 */
function parseScalar(raw) {
  const flow = /^\{(.*)\}$/u.exec(raw.trim())
  if (flow !== null) {
    const parts = flow[1].split(',').map(part => part.trim()).filter(part => part !== '')
    /** @type {Record<string, string>} */
    const map = {}
    for (const part of parts) {
      const m = /^([A-Za-z0-9_-]+):\s*"(.*)"$/u.exec(part)
      if (m === null) throw new Error(`branding: unsupported inline-map entry: ${part}`)
      map[m[1]] = m[2]
    }
    if (Object.keys(map).sort().join(',') !== 'en,zh') {
      throw new Error('branding: inline map must have exactly zh and en keys')
    }
    return { zh: map.zh, en: map.en }
  }
  const quoted = /^"(.*)"$/u.exec(raw.trim())
  if (quoted === null) throw new Error(`branding: value must be a double-quoted string: ${raw}`)
  return quoted[1]
}

/**
 * 解析 branding.yaml 文本为 `{ section: { key: scalar } }` 树（两层）。
 * 与 web-ui build.mjs 的解析器同构：顶层 section + 一层缩进键，注释 strip。
 * @param source - yaml 文本。
 * @returns 两层解析树。
 */
export function parseBrandingTree(source) {
  /** @type {Record<string, Record<string, string | { zh: string; en: string }>>} */
  const tree = {}
  let section = ''
  for (const rawLine of source.split(/\r?\n/)) {
    const text = rawLine.replace(/#.*$/u, '').trimEnd()
    if (text.trim() === '') continue
    const indented = /^ {2}\S/u.test(text)
    if (!indented && !/^\S/u.test(text)) throw new Error(`branding: unsupported indentation: ${rawLine}`)
    const match = /^ ?([^:]+):(?: (.*))?$/u.exec(text)
    if (match === null) throw new Error(`branding: unparsable line: ${rawLine}`)
    const key = match[1].trim()
    const rawValue = match[2]
    if (indented) {
      const bucket = tree[section]
      if (bucket === undefined) throw new Error(`branding: nested key outside a section: ${rawLine}`)
      if (rawValue === undefined || rawValue === '') throw new Error(`branding: section ${section} key ${key} needs a value`)
      bucket[key] = parseScalar(rawValue)
    } else {
      if (rawValue !== undefined && rawValue !== '') throw new Error(`branding: top-level key must open a section: ${rawLine}`)
      section = key
      tree[key] ??= {}
    }
  }
  return tree
}

/** 校验 + 归一化桌面壳品牌项。 */
export function shapeBranding(tree) {
  const product = tree.product
  const window = tree.window
  const desktop = tree.desktop
  if (product === undefined) throw new Error('branding: missing "product:" section')
  if (desktop === undefined) throw new Error('branding: missing "desktop:" section (P1-0 desktop shell)')
  if (window === undefined || typeof window.title !== 'string' || window.title === '') throw new Error('branding: missing/invalid window.title')
  const scalar = (section, key) => {
    const value = section[key]
    if (typeof value !== 'string') throw new Error(`branding: missing/invalid desktop.${key}`)
    return value
  }
  const name = product.name
  const nameDict = typeof name === 'string' ? { zh: name, en: name } : name
  return {
    brandId: scalar(desktop, 'brandId'),
    appId: scalar(desktop, 'appId'),
    productName: scalar(desktop, 'productName'),
    windowTitle: window.title,
    executableName: scalar(desktop, 'executableName'),
    icon: scalar(desktop, 'icon'),
    trayIcon: scalar(desktop, 'trayIcon'),
    updateUrl: scalar(desktop, 'updateUrl'),
    uninstallerDeleteAppData: scalar(desktop, 'uninstallerDeleteAppData') === 'true',
    nameZh: nameDict.zh,
    nameEn: nameDict.en,
  }
}

/** 从 branding.yaml 文件路径解析品牌。 */
export function readBranding(brandingYamlPath) {
  return shapeBranding(parseBrandingTree(readFileSync(brandingYamlPath, 'utf8')))
}

/** 仓库根默认 branding.yaml（dev 模式 / 构建脚本缺省）。 */
export function repoBrandingYaml(repoRoot) {
  return join(repoRoot, 'branding', 'default', 'branding.yaml')
}

/** 当前文件所在目录（apps/desktop/src）。 */
const here = dirname(fileURLToPath(import.meta.url))
/** apps/desktop 根。 */
export const DESKTOP_DIR = join(here, '..')
/** 仓库根（apps/desktop 的上级上级）。 */
export const REPO_ROOT = join(here, '..', '..', '..')

/**
 * 运行时加载品牌：打包后读 `resources/branding.json`（dist 编译产物）；
 * dev 回退读仓库 `branding/default/branding.yaml`（Electron `dev:electron`
 * 直接可用，无需先跑 dist）。
 */
export function loadBranding() {
  const compiled = join(DESKTOP_DIR, 'resources', 'branding.json')
  try {
    const json = JSON.parse(readFileSync(compiled, 'utf8'))
    if (typeof json?.brandId === 'string' && json.brandId !== '') return json
  } catch {
    // 未编译（dev）→ 回退 yaml
  }
  return readBranding(repoBrandingYaml(REPO_ROOT))
}
