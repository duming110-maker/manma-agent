/**
 * Build script: compile src/ into the single lib/ artifact the dsh host-plugin
 * contract expects for a host-only package.
 *
 * Artifact  lib/index.js — Node half, a plain ESM bundle the host Loader
 *                        imports as an object plugin. Runtime code touches
 *                        upstream ONLY through documented ctx.* services, so
 *                        today the bundle has zero runtime imports (the two
 *                        `import type` lines are erased); `@deepseek-ai/*`
 *                        stays external regardless, as the standing contract
 *                        for any future code added here.
 */
import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'

await mkdir('lib', { recursive: true })

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
