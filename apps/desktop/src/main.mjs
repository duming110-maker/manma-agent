/**
 * Desktop shell launcher — minimal Node entry (P0 spike, no Electron yet).
 *
 * Boots the official dsh Host with the upstream web stack PLUS the bc-agent
 * overlay by running the published `@deepseek-ai/dsh` CLI's public `dsh` bin:
 *
 *   dsh web --patch <repo>/profiles/bc-agent/cordis.patch.yml --host ... --port ...
 *
 * The overlay disables the official ui-layout row and appends @bc-agent/web-ui
 * (the self-built shell frame) plus @bc-agent/capability-core (the /ext
 * business RPC channel). Two prerequisites are ensured before launch for each
 * bc plugin, both idempotent:
 *
 * 1. the plugin's built lib/ artifacts exist (auto-built once when missing);
 * 2. the plugin is resolvable from the booted profile's directory — the host
 *    Loader entry and the client-modules scanner both resolve plugin packages
 *    from the profile tree, so the dependency is installed once through the
 *    official `dsh plugin --profile web add link:<path>` (a live link: edits +
 *    rebuilds are picked up on the next launch, no re-add needed).
 *
 * The Host webserver is pinned to loopback (iron rule 6) with an OS-assigned
 * port; the URL line the Host prints carries the concrete port. Spike data
 * (profile tree, storages, session logs) lands under
 * `apps/desktop/.data/dsh-home` via `DSH_HOME` — never on `C:\` and never in
 * `reference/`. An explicit `DSH_HOME` in the environment wins, so a real
 * deployment can point it elsewhere without code changes.
 *
 * @module desktop/main
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The only upstream surface this entry touches: the CLI package manifest (to reach its bin). */
const DSH_PACKAGE = '@deepseek-ai/dsh/package.json'

/** Loopback bind host, pinned — the Host must never listen on other interfaces (iron rule 6). */
const HOST = '127.0.0.1'

/** Port 0 asks the OS for a free port; the Host prints the assigned one in its URL line. */
const PORT = '0'

/** Spike data root, relative to this file: `apps/desktop/.data/dsh-home`. */
const SPIKE_DSH_HOME = fileURLToPath(new URL('../.data/dsh-home', import.meta.url))

/** The booted profile (the `web` template: dsh-base + dsh-web-app). */
const PROFILE = 'web'

/** bc-agent assembly overlay, relative to this file: `<repo>/profiles/bc-agent/cordis.patch.yml`. */
const BC_PATCH = fileURLToPath(new URL('../../../profiles/bc-agent/cordis.patch.yml', import.meta.url))

/**
 * Our plugin packages, relative to this file: `<repo>/packages/<pkg>`.
 * `artifacts` are the built lib/ files whose presence means "already built"
 * (the client plugin carries a second browser half; host-only packages do not).
 * @typedef {{name: string, dir: string, artifacts: string[]}} BcPlugin
 * @type {BcPlugin[]}
 */
const BC_PLUGINS = [
  {
    name: '@bc-agent/web-ui',
    dir: fileURLToPath(new URL('../../../packages/web-ui', import.meta.url)),
    artifacts: ['lib/index.js', 'lib/client.js'],
  },
  {
    name: '@bc-agent/capability-core',
    dir: fileURLToPath(new URL('../../../packages/capability-core', import.meta.url)),
    artifacts: ['lib/index.js'],
  },
]

/**
 * Resolve the installed CLI's `dsh` bin through its manifest's `bin` field.
 * @returns the absolute path of `lib/bin.js` inside the installed `@deepseek-ai/dsh`.
 */
function resolveDshBin() {
  const require = createRequire(import.meta.url)
  const manifestPath = require.resolve(DSH_PACKAGE)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const bin = manifest.bin?.dsh
  if (typeof bin !== 'string') throw new Error(`desktop: ${DSH_PACKAGE} has no "bin.dsh" entry`)
  return join(dirname(manifestPath), bin)
}

/** Run one command and mirror its exit status; a non-zero status fails the launch.
 * @param {string} command - executable to run.
 * @param {string[]} args - arguments.
 * @param {string} cwd - working directory.
 * @param {NodeJS.ProcessEnv} env - environment.
 * @param {string} what - human-readable step description for diagnostics.
 */
function runStep(command, args, cwd, env, what) {
  process.stderr.write(`desktop: ${what}\n`)
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' })
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`desktop: step failed: ${what} (${String(result.error ?? `exit ${String(result.status)}`)})`)
  }
}

/** Ensure one plugin's built lib/ artifacts exist (auto-built once when missing).
 * @param {BcPlugin} plugin - the plugin to check/build.
 * @param {NodeJS.ProcessEnv} env - environment (module resolution paths).
 */
function ensurePluginBuilt(plugin, env) {
  if (plugin.artifacts.every(artifact => existsSync(join(plugin.dir, artifact)))) return
  runStep(process.execPath, ['build.mjs'], plugin.dir, env, `building ${plugin.name} (first run)`)
}

/**
 * Ensure the booted profile can resolve one plugin package (Loader entry +
 * client-modules scanner resolve plugin packages from the profile tree).
 * Installs it once through the official plugin manager as a live link.
 * @param {string} bin - absolute path of the dsh CLI bin.
 * @param {BcPlugin} plugin - the plugin to install.
 * @param {string} dshHome - the effective DSH_HOME.
 * @param {NodeJS.ProcessEnv} env - environment for the child.
 */
function ensurePluginInProfile(bin, plugin, dshHome, env) {
  const installedMarker = join(dshHome, 'profiles', PROFILE, 'node_modules', ...plugin.name.split('/'), 'package.json')
  if (existsSync(installedMarker)) return
  runStep(
    process.execPath,
    [bin, 'plugin', '--profile', PROFILE, 'add', `link:${plugin.dir}`],
    dirname(bin),
    env,
    `installing ${plugin.name} into the '${PROFILE}' profile (dsh plugin add, one-time)`,
  )
  if (!existsSync(installedMarker)) {
    throw new Error(`desktop: ${plugin.name} still unresolvable from the profile after install (${installedMarker})`)
  }
}

/** Run the idempotent prerequisites for every bc plugin: build, then profile link.
 * @param {string} bin - absolute path of the dsh CLI bin.
 * @param {string} dshHome - the effective DSH_HOME.
 * @param {NodeJS.ProcessEnv} env - environment for the children.
 */
function ensurePluginsReady(bin, dshHome, env) {
  for (const plugin of BC_PLUGINS) {
    ensurePluginBuilt(plugin, env)
    ensurePluginInProfile(bin, plugin, dshHome, env)
  }
}

/**
 * Run the Host CLI as a child process and mirror its exit status.
 * @returns the process exit code to set.
 */
function runHost() {
  const bin = resolveDshBin()
  const env = {
    ...process.env,
    ...(process.env.DSH_HOME === undefined || process.env.DSH_HOME.trim() === ''
      ? { DSH_HOME: SPIKE_DSH_HOME }
      : {}),
    // Telemetry is DISABLED by default upstream and uploads only with an
    // explicit exporter config; pin the hard-disable switch anyway (iron rule 6).
    ...(process.env.DSH_TELEMETRY_DISABLED === undefined
      ? { DSH_TELEMETRY_DISABLED: '1' }
      : {}),
  }
  mkdirSync(env.DSH_HOME, { recursive: true })
  process.stderr.write(`desktop: dsh home ${env.DSH_HOME}\n`)
  process.stderr.write(`desktop: bc-agent patch ${BC_PATCH}\n`)

  ensurePluginsReady(bin, env.DSH_HOME, env)

  const child = spawn(
    process.execPath,
    // Launcher flags come first: `web` is the profile alias, --patch is the
    // launcher's own overlay flag, and --host/--port belong to the web app.
    [bin, 'web', '--patch', BC_PATCH, '--host', HOST, '--port', PORT],
    { stdio: 'inherit', env },
  )
  // The child owns graceful shutdown (the CLI wires its own signal handlers);
  // forward terminal signals and mirror its exit status.
  const forward = (signal) => { if (!child.killed) child.kill(signal) }
  process.on('SIGINT', () => { forward('SIGINT') })
  process.on('SIGTERM', () => { forward('SIGTERM') })
  return new Promise((resolveExit) => {
    child.once('error', (error) => {
      process.stderr.write(`desktop: failed to start dsh: ${error instanceof Error ? error.message : String(error)}\n`)
      resolveExit(1)
    })
    child.once('exit', (code, signal) => {
      resolveExit(code ?? (signal === null ? 1 : 128))
    })
  })
}

process.exitCode = await runHost()
