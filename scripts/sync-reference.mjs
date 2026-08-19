/**
 * Sync the read-only reference mirror (reference/) from the pinned upstream.
 *
 * Usage: node scripts/sync-reference.mjs   (or `pnpm run sync:reference`)
 *
 * - Pulls reference/upstream to the branch recorded in upstream.json.
 * - Copies the configured demo dirs (upstream.json -> reference.demoDirs)
 *   from upstream demo/ into reference/demo/.
 * - Copies upstream demo/docs/ into reference/design/.
 * - Writes the new HEAD sha + fetchedAt back into upstream.json.
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

// 1) upstream git mirror
if (!existsSync(upstreamDir)) {
  mkdirSync(upstreamDir, { recursive: true })
  run('git', ['clone', '--depth', '1', '--branch', cfg.branch, cfg.remote, upstreamDir], ROOT)
} else {
  run('git', ['fetch', '--depth', '1', 'origin', cfg.branch], upstreamDir)
  run('git', ['checkout', '--detach'], upstreamDir)
  run('git', ['reset', '--hard', `origin/${cfg.branch}`], upstreamDir)
}
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: upstreamDir, encoding: 'utf8' }).trim()

// 2) demo dirs
mkdirSync(demoDir, { recursive: true })
for (const name of cfg.reference.demoDirs ?? []) {
  const src = join(upstreamDir, 'demo', name)
  const dst = join(demoDir, name)
  if (!existsSync(src)) {
    console.warn(`[skip] demo/${name} not found upstream`)
    continue
  }
  rmSync(dst, { recursive: true, force: true })
  cpSync(src, dst, { recursive: true })
  console.log(`[demo] ${name}`)
}

// 3) design docs (v0.8.1 design doc lives under upstream demo/docs)
const docsSrc = join(upstreamDir, 'demo', 'docs')
if (existsSync(docsSrc)) {
  mkdirSync(designDir, { recursive: true })
  cpSync(docsSrc, designDir, { recursive: true })
  console.log('[design] demo/docs -> reference/design')
}

// 4) write back
cfg.reference.sha = sha
cfg.reference.fetchedAt = new Date().toISOString().slice(0, 10)
writeFileSync(upstreamJsonPath, JSON.stringify(cfg, null, 2) + '\n')

console.log(`\nDone. reference/upstream @ ${sha}`)
console.log('Reminder: syncing reference is NOT an upstream dependency upgrade.')
