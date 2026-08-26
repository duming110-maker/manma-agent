/**
 * Build script: compile src/ into the single lib/ artifact the dsh host-plugin
 * contract expects for a host-only package.
 *
 * Artifact  lib/index.js — Node half, a plain ESM bundle the host Loader
 *                        imports as an object plugin. Only node builtins are
 *                        used at runtime; `@deepseek-ai/*` stays external as
 *                        the standing contract (the one cordis import is a
 *                        type-only import and is erased).
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