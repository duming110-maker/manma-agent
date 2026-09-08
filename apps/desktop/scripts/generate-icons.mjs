/**
 * 图标生成（P1-0）：优先使用品牌图标文件（branding.yaml desktop.icon /
 * desktop.trayIcon，相对品牌目录，PNG ≥256），转出 `build/icon.png`（256）、
 * `build/icon.ico`（16/32/48/256 多尺寸，经 png-to-ico）、
 * `build/tray-icon.png`（64，无独立托盘图时从应用图标缩出）。品牌目录没有
 * 图标文件时回退程序化渲染（避免引入 native sharp）——品牌主色圆角方块 +
 * 中央亮块。默认品牌图标随仓库提交（branding/default/icon.png）。
 *
 * PNG 编码最小实现：签名 + IHDR + IDAT（zlib deflate）+ IEND，CRC32 查表法。
 * @module desktop/scripts/generate-icons
 */

import { deflateSync } from 'node:zlib'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import pngToIco from 'png-to-ico'
import { DESKTOP_DIR, readBranding } from '../src/branding.mjs'

const require = createRequire(import.meta.url)
// png-to-ico 内部 PNG 工具（该包无 exports 字段，子路径可引）：readPNG/resize
// 均基于它自带的 pngjs，解码/缩放品牌图标无需再引入独立的图像库。
const { readPNG, resize } = require('png-to-ico/lib/png')

/** PNG 签名。 */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** CRC32 查表（PNG chunk 校验）。 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

/** 计算 buffer 的 CRC32。 */
function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** 拼一个 PNG chunk（len + type + data + CRC；总长 12 + data.length）。 */
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const out = Buffer.alloc(8 + body.length)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 4 + body.length)
  return out
}

/** 解析 "rgb(r, g, b)" 字符串。 */
function parseRgb(text) {
  const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/u.exec(text.trim())
  if (m === null) throw new Error(`icons: unsupported color "${text}" (expected rgb(r, g, b))`)
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
}

/** 圆角矩形包含测试。 */
function inRoundedRect(x, y, size, inset, radius) {
  const x0 = inset
  const y0 = inset
  const x1 = size - inset
  const y1 = size - inset
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.max(x0 + radius, Math.min(x, x1 - radius))
  const cy = Math.max(y0 + radius, Math.min(y, y1 - radius))
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius
}

/** 生成一张 RGBA PNG：品牌主色圆角方块 + 中央亮块。 */
function renderPng(size, color) {
  const radius = size * 0.22
  const inset = size * 0.06
  const innerInset = size * 0.32
  const light = {
    r: Math.min(255, color.r + 90),
    g: Math.min(255, color.g + 90),
    b: Math.min(255, color.b + 90),
  }
  const rows = []
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4)
    row[0] = 0 // filter: none
    for (let x = 0; x < size; x += 1) {
      const offset = 1 + x * 4
      if (!inRoundedRect(x, y, size, inset, radius)) continue
      const pixel = inRoundedRect(x, y, size, innerInset, radius * 0.5) ? light : color
      row[offset] = pixel.r
      row[offset + 1] = pixel.g
      row[offset + 2] = pixel.b
      row[offset + 3] = 255
    }
    rows.push(row)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 读 branding.theme.primary（主色；web-ui 严格解析器已保证 `primary: "rgb(...)"` 格式）。 */
function readThemePrimary(brandYaml) {
  const m = /^  primary: "([^"]+)"/m.exec(readFileSync(brandYaml, 'utf8'))
  if (m === null) throw new Error(`icons: branding.theme.primary not found in ${brandYaml}`)
  return m[1]
}

/** pngjs 实例 → PNG 字节（pngjs 类经实例 constructor 获得，不直接依赖 pngjs）。 */
function encodePng(png) {
  return png.constructor.sync.write(png)
}

/** 主流程：优先品牌图标文件，缺省回退主色渲染，输出 build/ 图标。 */
export async function generateIcons(options) {
  const branding = readBranding(options.brandYaml)
  const brandDir = dirname(options.brandYaml)
  const buildDir = join(DESKTOP_DIR, 'build')
  mkdirSync(buildDir, { recursive: true })

  // 品牌图标文件（branding.yaml desktop.icon）：存在则以其为源转出全套产物。
  // pngToIco 单路径形态内部缩放 16/32/48/256（源为任意尺寸方形 PNG）。
  const iconPath = join(brandDir, branding.icon)
  if (existsSync(iconPath)) {
    const source = await readPNG(iconPath)
    if (source.width !== source.height) {
      throw new Error(`icons: brand icon must be square (got ${source.width}x${source.height})`)
    }
    writeFileSync(join(buildDir, 'icon.png'), encodePng(resize(source, 256, 256)))
    writeFileSync(join(buildDir, 'icon.ico'), await pngToIco(iconPath))
    // 托盘图：branding.yaml desktop.trayIcon 优先；缺省从应用图标缩 64。
    const trayPath = join(brandDir, branding.trayIcon)
    const traySource = existsSync(trayPath) ? await readPNG(trayPath) : source
    writeFileSync(join(buildDir, 'tray-icon.png'), encodePng(resize(traySource, 64, 64)))
    console.log(`-> icons from brand files (brand ${branding.brandId})`)
    return
  }

  // 回退：按品牌主色程序化渲染占位图标。
  const color = parseRgb(readThemePrimary(options.brandYaml))
  const png256 = renderPng(256, color)
  writeFileSync(join(buildDir, 'icon.png'), png256)
  writeFileSync(join(buildDir, 'tray-icon.png'), renderPng(64, color))
  const ico = await pngToIco([renderPng(16, color), renderPng(32, color), renderPng(48, color), png256])
  writeFileSync(join(buildDir, 'icon.ico'), ico)
  console.log(`-> icons rendered from primary color (brand ${branding.brandId})`)
}
