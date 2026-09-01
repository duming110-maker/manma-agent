/**
 * Scene-editor host capability: enumerate locally installed code editors,
 * remember the user's default "open with" method, and open the active
 * session's directory in a chosen editor. The header's split button「打开」
 * fires the default method directly (`explorer` → the official reveal/open,
 * an editor id → `scene.editor.open`); its dropdown switches the default.
 *
 * Detection is a Windows-first known-path scan (the repo is Windows-first:
 * node-pty uses windowsTerminal.js, file-open's reveal path special-cases
 * win32) and runs ONCE at plugin apply — the roster is fixed for the process
 * lifetime, re-detected on next startup. Each editor declares its canonical
 * install roots; the first existing executable wins, so one editor = one row
 * no matter how many roots match. No new dependencies and no registry
 * crawling — plain `existsSync` over a fixed roster. Launches are full `.exe`
 * paths (never PATH `.cmd` shims), so the spawn is a direct detached process
 * that survives the host.
 *
 * The default "open with" method persists to `$DSH_HOME/bc-scene-editor.json`
 * (the same JSON-store convention as the cron task/run stores).
 *
 * @module @bc-agent/capability-core/scene-editor
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { badRequest, dshHome } from './skill-core.ts'

/** One detected editor (id stays stable across the client/host wire). */
export interface UpstreamEditor {
  id: string
  name: string
  /** Absolute executable path resolved from the first existing root. */
  path: string
}

/** Per-editor candidate roots (Windows install locations). */
interface IdeDef {
  id: string
  name: string
  paths: readonly string[]
}

/** The built-in "open in File Explorer" method id (shared client/host). */
const EXPLORER_METHOD = 'explorer'

const LOCAL = process.env.LOCALAPPDATA ?? ''

/**
 * The known-editor roster, ordered for the menu (VS Code first, the rest
 * alphabetic). Candidate paths are checked in order; the first existing one
 * wins.
 */
const IDE_DEFS: readonly IdeDef[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    paths: [
      `${LOCAL}\\Programs\\Microsoft VS Code\\Code.exe`,
      'C:\\Program Files\\Microsoft VS Code\\Code.exe',
      'C:\\Program Files (x86)\\Microsoft VS Code\\Code.exe',
    ],
  },
  {
    id: 'vscode-insiders',
    name: 'Visual Studio Code Insiders',
    paths: [
      `${LOCAL}\\Programs\\Microsoft VS Code Insiders\\Code - Insiders.exe`,
      'C:\\Program Files\\Microsoft VS Code Insiders\\Code - Insiders.exe',
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    paths: [
      `${LOCAL}\\Programs\\Cursor\\Cursor.exe`,
      `${LOCAL}\\Programs\\cursor\\Cursor.exe`,
      'C:\\Program Files\\Cursor\\Cursor.exe',
    ],
  },
  {
    id: 'trae',
    name: 'Trae',
    paths: [
      `${LOCAL}\\Programs\\Trae\\Trae.exe`,
      'C:\\Program Files\\Trae\\Trae.exe',
    ],
  },
  {
    id: 'trae-cn',
    name: 'Trae CN',
    paths: [
      `${LOCAL}\\Programs\\Trae CN\\Trae CN.exe`,
      `${LOCAL}\\Programs\\Trae CN\\Trae.exe`,
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    paths: [
      `${LOCAL}\\Programs\\Windsurf\\Windsurf.exe`,
      'C:\\Program Files\\Windsurf\\Windsurf.exe',
    ],
  },
]

/** Resolve one editor's executable, or undefined when none of its roots exist. */
function resolveExe(def: IdeDef): string | undefined {
  return def.paths.find(path => existsSync(path))
}

// ---------------------------------------------------------------------------
// detection (run once at apply, fixed for the process lifetime)
// ---------------------------------------------------------------------------

let editorCache: readonly UpstreamEditor[] | undefined

/** Detect installed editors, caching the roster for the process lifetime. */
export function detectEditors(): readonly UpstreamEditor[] {
  if (editorCache === undefined) {
    const editors: UpstreamEditor[] = []
    for (const def of IDE_DEFS) {
      const path = resolveExe(def)
      if (path !== undefined) editors.push({ id: def.id, name: def.name, path })
    }
    editorCache = editors
  }
  return editorCache
}

/** Enumerate the (startup-cached) installed editors. */
export function listInstalledEditors(): readonly UpstreamEditor[] {
  return detectEditors()
}

// ---------------------------------------------------------------------------
// default "open with" method (JSON store in dshHome)
// ---------------------------------------------------------------------------

function sceneConfigPath(): string {
  return join(dshHome(), 'bc-scene-editor.json')
}

/** Whether a method id is known (the explorer built-in or a roster editor). */
function isKnownMethod(id: string): boolean {
  return id === EXPLORER_METHOD || IDE_DEFS.some(def => def.id === id)
}

/** Read the persisted default open method, falling back to the explorer. */
export function readDefaultOpen(): string {
  try {
    const raw = readFileSync(sceneConfigPath(), 'utf8')
    const text = raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
    const cfg = JSON.parse(text) as { defaultOpen?: unknown }
    return typeof cfg.defaultOpen === 'string' && isKnownMethod(cfg.defaultOpen)
      ? cfg.defaultOpen
      : EXPLORER_METHOD
  } catch {
    return EXPLORER_METHOD
  }
}

/** Persist the default open method (payload: `{ id }`). */
export function setDefaultOpen(payload: unknown):
  | { ok: true; value: { defaultOpen: string } }
  | ReturnType<typeof badRequest> {
  const p = payload as { id?: unknown }
  if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('scene.default.set requires id')
  if (!isKnownMethod(p.id)) return badRequest(`scene.default.set unknown id "${p.id}"`)
  mkdirSync(dshHome(), { recursive: true })
  writeFileSync(sceneConfigPath(), JSON.stringify({ defaultOpen: p.id }, null, 2) + '\n')
  return { ok: true, value: { defaultOpen: p.id } }
}

// ---------------------------------------------------------------------------
// launch
// ---------------------------------------------------------------------------

/** Fire-and-forget launch of a full `.exe` path (survives the host; errors logged). */
function launchDetached(command: string, args: readonly string[]): void {
  const child = spawn(command, [...args], { detached: true, stdio: 'ignore', windowsHide: true })
  child.once('error', (error: NodeJS.ErrnoException) => {
    console.warn(`bc-capability-core: failed to launch ${command}: ${error.message}`)
  })
  child.unref()
}

/** Open a directory in one detected editor (payload: `{ id, path }`). */
export function openEditor(payload: unknown):
  | { ok: true; value: { opened: true } }
  | ReturnType<typeof badRequest> {
  const p = payload as { id?: unknown; path?: unknown }
  if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('scene.editor.open requires id')
  if (typeof p.path !== 'string' || p.path.trim() === '') return badRequest('scene.editor.open requires path')
  const def = IDE_DEFS.find(item => item.id === p.id)
  if (def === undefined) return badRequest(`scene.editor.open unknown editor id "${p.id}"`)
  const exePath = resolveExe(def)
  if (exePath === undefined) return badRequest(`scene.editor.open editor "${p.id}" is not installed`)
  launchDetached(exePath, [p.path])
  return { ok: true, value: { opened: true } }
}