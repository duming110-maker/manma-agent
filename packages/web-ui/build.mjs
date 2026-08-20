/**
 * Build script: compile src/ into the two lib/ artifacts the dsh client-plugin
 * contract expects.
 *
 * Artifact 1  lib/index.js  — Node half, a plain ESM package the host Loader
 *                             imports as an object plugin (no host behavior).
 * Artifact 2  lib/client.js — browser half, wrapped as
 *                             window.__ModuleLoader__.load({ id, factory })
 *                             (the dsh frontend's lazy CJS module-table
 *                             convention, see reference skin-plugin +
 *                             packages/client/modules).
 *
 * Browser-bundle externals are exactly the words the shell shares into the
 * frozen module table plus the documented runtime `/client` exemption: react
 * comes from the official client runtime (D10 — no second React instance),
 * and any other @deepseek-ai value import would be a purity violation (type
 * imports are erased and never reach the bundle).
 *
 * Branding (iron rule 5, P2-f): the browser half is built with the branding
 * constants from ../../branding/default/branding.yaml compiled in at BUILD
 * time (single source; never a runtime file read). The yaml slice consumed
 * below is strict — a missing file, a missing key, or an unsupported line
 * fails the build (fail-loud; no silent hardcoded fallback anywhere).
 */
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Package name = graph row id = module-table registration key. */
const PKG_NAME = '@bc-agent/web-ui'

/** Shell module-table words this bundle requires, plus the runtime exemption. */
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-runtime/client']

/** The branding source of truth. `BC_BRAND_DIR` lets a branded build point at
 * `branding/<name>` (P1-0 dist pipeline + S7); the default mirrors the repo
 * layout `branding/default/` (relative to this package). An absolute Windows
 * brand dir must go through pathToFileURL (new URL rejects it). */
const BRANDING_YAML = process.env.BC_BRAND_DIR !== undefined && process.env.BC_BRAND_DIR !== ''
  ? pathToFileURL(join(process.env.BC_BRAND_DIR, 'branding.yaml'))
  : new URL('../../branding/default/branding.yaml', import.meta.url)

/**
 * Parse the branding yaml slice this build consumes: a strict subset — two
 * nesting levels, `key: value` scalars (double-quoted or plain), one inline
 * flow map ({ zh: "...", en: "..." }), comments, blank lines. Anything else
 * fails loud (the branding schema is ours; unknown shapes must not pass a
 * build silently).
 * @param {string} source - the raw yaml text.
 * @returns {{product: {name: {zh: string, en: string}}, theme: Record<string, string>}} the branding payload.
 */
function parseBrandingYaml(source) {
  /** @type {Record<string, Record<string, unknown>>} */
  const tree = {}
  let section = ''
  for (const rawLine of source.split(/\r?\n/)) {
    // Strip trailing comments (none of our values contain '#'; a quoted value
    // containing ' #' would fail the scalar check below — fail-loud by design).
    const text = rawLine.replace(/#.*$/, '').trimEnd()
    if (text.trim() === '') continue
    const indented = /^ {2}\S/.test(text)
    const topLevel = /^\S/.test(text)
    if (!indented && !topLevel) throw new Error(`branding: unsupported indentation: ${rawLine}`)
    const match = /^ ?([^:]+):(?: (.*))?$/.exec(text)
    if (match === null) throw new Error(`branding: unparsable line: ${rawLine}`)
    const [, rawKey, rawValue] = match
    const key = rawKey.trim()
    if (indented) {
      const bucket = tree[section]
      if (section === '' || bucket === undefined) throw new Error(`branding: nested key outside a section: ${rawLine}`)
      if (rawValue === undefined || rawValue === '') throw new Error(`branding: section ${section} key ${key} needs a value`)
      bucket[key] = parseScalar(key, rawValue, rawLine)
    } else {
      if (rawValue !== undefined && rawValue !== '') throw new Error(`branding: top-level key ${key} must open a section, not carry a value: ${rawLine}`)
      section = key
      tree[key] ??= {}
    }
  }
  return shapeBranding(tree)
}

/**
 * Parse one scalar value: a double-quoted string or the two-key inline flow
 * map { zh: "...", en: "..." }.
 * @param {string} key - the key being parsed (for error messages).
 * @param {string} raw - the raw value text.
 * @param {string} line - the whole raw line (for error messages).
 * @returns {string | {zh: string, en: string}} the parsed value.
 */
function parseScalar(key, raw, line) {
    const flow = /^\{(.*)\}$/.exec(raw.trim())
    if (flow !== null) {
    const parts = flow[1].split(',').map(part => part.trim()).filter(part => part !== '')
    /** @type {Record<string, string>} */
    const map = {}
    for (const part of parts) {
      const m = /^([A-Za-z0-9_-]+):\s*"(.*)"$/.exec(part)
      if (m === null) throw new Error(`branding: unsupported inline-map entry: ${part} (${line})`)
      map[m[1]] = m[2]
    }
    const keys = Object.keys(map).sort().join(',')
    if (keys !== 'en,zh') throw new Error(`branding: inline map for ${key} must have exactly zh and en keys (${line})`)
    return { zh: map.zh, en: map.en }
  }
  const quoted = /^"(.*)"$/.exec(raw.trim())
  if (quoted === null) throw new Error(`branding: value of ${key} must be a double-quoted string or { zh: "...", en: "..." } (${line})`)
  return quoted[1]
}

/**
 * Validate + normalize the parsed tree into the payload the client consumes:
 * product.name accepts a single string (identical in both languages — the
 * docs/03 §9 per-language dictionary form may collapse to one value) or the
 * { zh, en } form; theme keys are all mandatory.
 * @param {Record<string, Record<string, unknown>>} tree - the parsed tree.
 * @returns {{product: {name: {zh: string, en: string}}, theme: Record<string, string>}} the payload.
 */
function shapeBranding(tree) {
  const product = tree.product
  const theme = tree.theme
  if (product === undefined) throw new Error('branding: missing "product:" section')
  if (theme === undefined) throw new Error('branding: missing "theme:" section')
  const name = product.name
  if (name === undefined) throw new Error('branding: missing product.name')
  const nameDict = typeof name === 'string' ? { zh: name, en: name } : name
  const themeKeys = ['primary', 'primaryHover', 'primaryActive', 'primaryDark', 'primaryDarkHover', 'primaryDarkActive']
  /** @type {Record<string, string>} */
  const themeOut = {}
  for (const k of themeKeys) {
    const v = theme[k]
    if (typeof v !== 'string' || v === '') throw new Error(`branding: missing or invalid theme.${k}`)
    themeOut[k] = v
  }
  for (const k of Object.keys(theme)) {
    if (!themeKeys.includes(k)) throw new Error(`branding: unknown theme key "${k}"`)
  }
  return { product: { name: nameDict }, theme: themeOut }
}

// ---- Branding payload (build-time single source) ----------------------------
let brandingText
try {
  brandingText = readFileSync(BRANDING_YAML, 'utf8')
} catch (error) {
  throw new Error(`branding: cannot read ${BRANDING_YAML.pathname} (${String(error)})`)
}
const branding = parseBrandingYaml(brandingText)
console.log(`-> branding from branding/default/branding.yaml (name.zh="${branding.product.name.zh}", name.en="${branding.product.name.en}", theme.primary=${branding.theme.primary})`)

await mkdir('lib', { recursive: true })

// ---- Artifact 1: Node half ------------------------------------------------
// @deepseek-ai/* stays external: provided by the dsh host (peerDependency).
// (The Node half consumes no branding: it is all browser-side.)
await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  external: ['@deepseek-ai/*'],
  logLevel: 'info',
})

// ---- Artifact 2: browser half ----------------------------------------------
// Compiled to CJS text (write: false), then hand-wrapped into the registration
// shell. Script execution only REGISTERS the factory; the plugin body runs at
// materialization (factory(require) → exports). The branding payload rides
// esbuild `define`: every __BC_BRANDING__ identifier reference in the source
// becomes the JSON literal (see src/client/branding.ts — the declared
// identifier has no runtime fallback, an uninjected build would throw).
await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  // write:true + outfile is required for an EXTERNAL sourcemap (write:false
  // rejects `sourcemap:'external'` — no output path to name the map); esbuild
  // writes lib/client.js + lib/client.js.map, then we re-wrap the JS below.
  outfile: 'lib/client.js',
  sourcemap: 'external',
  external: CLIENT_EXTERNALS,
  jsx: 'automatic',
  define: { __BC_BRANDING__: JSON.stringify(JSON.stringify(branding)) },
})
// esbuild's own client.js carries the `//# sourceMappingURL` comment; strip it
// before wrapping, then append ours after the shell so the browser resolves the
// served `client.js.map` (P0-5 contract C9). The 8-line shell offset is a known
// DevTools tolerance — the sourcesContent payload is the debugging value.
const rawCode = readFileSync(new URL('./lib/client.js', import.meta.url), 'utf8')
  .replace(/\n?\/\/# sourceMappingURL=.*\n?$/, '')
const wrapped = `window.__ModuleLoader__.load({
  id: '${PKG_NAME}',
  factory: (require) => {
    const module = { exports: {} }
    const exports = module.exports
${rawCode}
    return module.exports
  },
})
//# sourceMappingURL=client.js.map
`

await writeFile('lib/client.js', wrapped, 'utf8')
console.log(`-> lib/client.js (${wrapped.length} bytes)`)
console.log('-> lib/client.js.map (sourcemap)')
