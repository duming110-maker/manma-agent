/**
 * Sync the read-only reference mirror (reference/) from its two sources.
 *
 * Usage: node scripts/sync-reference.mjs   (or `pnpm run sync:reference`)
 *
 * Two sources, two kinds of material:
 *  1. reference/upstream  — official deepseek-harness source, pulled from git
 *     (the remote/branch in upstream.json). This is the "periodic pull".
 *  2. reference/demo + reference/design — LOCAL research materials (自研前端、
 *     桌面参考、skin-plugin、TAM、v0.8.1 设计文档). These are NOT in the
 *     upstream git repo (demo/ is untracked), so they are copied from the
 *     local directory named by upstream.json -> reference.demoSource.
 *
 * reference/ is gitignored: it never ships and is never part of an
 * open-source release. Syncing reference is NOT an upstream dependency
 * upgrade (that is: change package.json versions + run smoke S1-S10).
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const upstreamJsonPath = join(ROOT, 'upstream.json')
const upstreamDir = join(ROOT, 'reference', 'upstream')
const demoDir = join(ROOT, 'reference', 'demo')
const designDir = join(ROOT, 'reference', 'design')

const cfg = JSON.parse(readFileSync(upstreamJsonPath, 'utf8'))

function run(cmd, args, cwd) {
  execFileSync(cmd, args, { cwd, stdio: 'inherit' })
}

// 1) official upstream source, from git
if (!existsSync(upstreamDir)) {
  mkdirSync(upstreamDir, { recursive: true })
  run('git', ['clone', '--depth', '1', '--branch', cfg.branch, cfg.remote, upstreamDir], ROOT)
} else {
  run('git', ['fetch', '--depth', '1', 'origin', cfg.branch], upstreamDir)
  run('git', ['checkout', '--detach'], upstreamDir)
  run('git', ['reset', '--hard', `origin/${cfg.branch}`], upstreamDir)
}
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstreamDir, encoding: 'utf8' }).trim()

// 2) local demo materials, copied from demoSource (NOT from git)
const demoSource = cfg.reference.demoSource
if (demoSource && existsSync(demoSource)) {
  mkdirSync(demoDir, { recursive: true })
  for (const name of cfg.reference.demoDirs ?? []) {
    const src = join(demoSource, name)
    const dst = join(demoDir, name)
    if (!existsSync(src)) {
      console.warn(`[skip] demo/${name} not found at ${demoSource}`)
      continue
    }
    rmSync(dst, { recursive: true, force: true })
    cpSync(src, dst, { recursive: true })
    console.log(`[demo] ${name}`)
  }

  // 3) design docs: demoSource/docs -> reference/design
  const docsSrc = join(demoSource, 'docs')
  if (existsSync(docsSrc)) {
    mkdirSync(designDir, { recursive: true })
    cpSync(docsSrc, designDir, { recursive: true })
    console.log('[design] demoSource/docs -> reference/design')
  }
} else {
  console.warn(`[warn] demoSource "${demoSource}" not found; demo/design not synced.`)
  console.warn('       demo materials are LOCAL (untracked in upstream); set upstream.json.reference.demoSource.')
}

// 4) write back
cfg.reference.sha = sha
cfg.reference.fetchedAt = new Date().toISOString().slice(0, 10)
writeFileSync(upstreamJsonPath, JSON.stringify(cfg, null, 2) + '\n')

console.log(`\nDone. reference/upstream @ ${sha}`)
console.log('Reminder: syncing reference is NOT an upstream dependency upgrade.')
