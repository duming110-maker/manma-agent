/**
 * bc-file-open: a host-only plugin that decides how a file clicked in the chat
 * page is opened, keyed by the file's extension and driven by a JSON config
 * file (no UI). It wraps the single documented host-side point every chat
 * file-open gesture funnels through — `ctx.apiProxy.host.openPath` — and
 * dispatches per the configured action. Nothing upstream is modified: the
 * original handler is captured on apply and restored on dispose.
 *
 * Config file (hand-edited, absent = everything behaves as "default"):
 *   $DSH_HOME/bc-file-open.json
 *
 *   {
 *     "rules": [
 *       { "extensions": ["txt", "md", "json"], "action": "program", "program": "code.exe" },
 *       { "extensions": ["pdf"], "action": "default" },
 *       { "extensions": ["log"], "action": "folder" },
 *       { "extensions": ["tmp", "bak"], "action": "disabled" }
 *     ]
 *   }
 *
 * Actions:
 *   - "default"  -> system default (delegate to the original openPath)
 *   - "program"  -> launch `program` with the file path (fire-and-forget); on
 *                   Windows a bare name / `.cmd` / `.bat` shim (e.g. `code`,
 *                   `code.cmd`) is resolved through cmd.exe like an interactive
 *                   prompt, while a full `.exe` path is spawned directly.
 *   - "folder"   -> reveal the file in its containing folder
 *   - "disabled" -> do nothing (acknowledged as a no-op)
 *
 * Matching: first rule whose `extensions` contains the file's extension wins;
 * cases are normalized, a leading dot is optional, and "*" matches any
 * extension. A missing or malformed config falls back to "default".
 *
 * @module @bc-agent/file-open
 */

import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, extname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

/** The four open modes the config can request. */
type Action = 'default' | 'program' | 'folder' | 'disabled'

/** One configured rule: a set of extensions bound to one action. */
interface Rule {
  extensions: readonly string[]
  action: Action
  program?: string
}

/** The config document root (rules drive the policy; everything else is ignored). */
interface FileOpenConfig {
  rules?: unknown
}

/** Resolve the effective DSH home (mirrors capability-core's dshHome). */
function dshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

function configPath(): string {
  return join(dshHome(), 'bc-file-open.json')
}

function isAction(value: unknown): value is Action {
  return value === 'default' || value === 'program' || value === 'folder' || value === 'disabled'
}

/** Collect the string entries of an `extensions` list; a non-array is invalid. */
function normalizeExtensions(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string') out.push(item)
  }
  return out
}

/** Validate one raw JSON rule; malformed rules are dropped (never crash). */
function normalizeRule(raw: unknown): Rule | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const r = raw as { extensions?: unknown; action?: unknown; program?: unknown }
  if (!isAction(r.action)) return undefined
  const extensions = normalizeExtensions(r.extensions)
  if (extensions === undefined) return undefined
  if (r.action === 'program') {
    if (typeof r.program !== 'string' || r.program.trim() === '') return undefined
    return { extensions, action: 'program', program: r.program }
  }
  return { extensions, action: r.action }
}

/** Read + validate the config; any absent/broken state yields the default behavior. */
function loadRules(): Rule[] {
  const path = configPath()
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch (error) {
    // An absent file is the normal default; other read errors surface once.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.warn(`bc-file-open: cannot read config ${path}: ${(error as Error).message}`)
    }
    return []
  }
  try {
    const data = JSON.parse(text) as FileOpenConfig
    if (!Array.isArray(data.rules)) return []
    return data.rules.map(normalizeRule).filter((rule): rule is Rule => rule !== undefined)
  } catch (error) {
    console.warn(`bc-file-open: invalid config ${path}: ${(error as Error).message}`)
    return []
  }
}

/** The normalized, lower-cased extension of a path ('' when there is none). */
function extOf(path: string): string {
  const ext = extname(path)
  return ext.length > 1 ? ext.slice(1).toLowerCase() : ''
}

function ruleMatches(rule: Rule, ext: string): boolean {
  return rule.extensions.some((entry) => {
    const normalized = entry.trim().replace(/^\./, '').toLowerCase()
    return normalized === '*' || normalized === ext
  })
}

/** First matching rule for a path, or undefined → default behavior. */
function resolveRule(path: string): Rule | undefined {
  const ext = extOf(path)
  for (const rule of loadRules()) {
    if (ruleMatches(rule, ext)) return rule
  }
  return undefined
}

// ---------------------------------------------------------------------------
// open dispatch
// ---------------------------------------------------------------------------

/** Minimal structural view of the host.openPath wire (carrier package not a dependency). */
interface OpenPathRequest {
  rpcId: unknown
  payload: { path: string }
}
interface OpenPathResponse {
  rpcId: unknown
  result:
    | { ok: true; value: { opened: true } }
    | { ok: false; error: { code: string; message: string; details: unknown } }
}
type OpenPathHandler = (request: OpenPathRequest, signal: AbortSignal) => Promise<OpenPathResponse>
interface ApiProxyFace {
  host: { openPath: OpenPathHandler }
}

/** Quote one argv token for cmd.exe (only when it carries spaces or quotes). */
function quoteForCmd(token: string): string {
  return /[\s"]/.test(token) ? `"${token.replace(/"/g, '""')}"` : token
}

/** Windows: run through cmd.exe when the command is a bare name (PATH-resolved)
 * or a `.cmd`/`.bat` shim like `code`/`code.cmd` — plain `spawn` only finds
 * `.exe`/`.com`. A full `.exe` path is spawned directly to dodge cmd `/s` quote
 * stripping on the leading token. */
function needsCmdShell(command: string): boolean {
  return process.platform === 'win32' && !/[\\/]/.test(command)
}

/** Launch a program detached so long-running editors survive the host; errors are logged, not thrown. */
function launchDetached(command: string, args: readonly string[]): void {
  const child = needsCmdShell(command)
    ? spawn(
        process.env.ComSpec || 'cmd.exe',
        ['/d', '/s', '/c', [command, ...args].map(quoteForCmd).join(' ')],
        { detached: true, stdio: 'ignore', windowsHide: true },
      )
    : spawn(command, [...args], { detached: true, stdio: 'ignore', windowsHide: true })
  child.once('error', (error: NodeJS.ErrnoException) => {
    console.warn(`bc-file-open: failed to launch ${command}: ${error.message}`)
  })
  child.unref()
}

/** Reveal a file in its containing folder using the platform's file manager. */
function revealInFolder(path: string): void {
  if (process.platform === 'win32') {
    launchDetached('explorer.exe', ['/select,', path])
  } else if (process.platform === 'darwin') {
    launchDetached('open', ['-R', path])
  } else {
    launchDetached('xdg-open', [dirname(path)])
  }
}

/** Run one configured action (synchronous parts only; launch errors are fire-and-forget). */
function applyAction(rule: Rule, path: string): void {
  switch (rule.action) {
    case 'program': {
      const program = rule.program
      if (program === undefined || program.trim() === '') {
        throw new Error('bc-file-open: "program" action requires a non-empty program')
      }
      launchDetached(program, [path])
      return
    }
    case 'folder':
      revealInFolder(path)
      return
    case 'disabled':
      return
    case 'default':
      return
  }
}

function opened(request: OpenPathRequest): OpenPathResponse {
  return { rpcId: request.rpcId, result: { ok: true, value: { opened: true } } }
}

function failed(request: OpenPathRequest, message: string): OpenPathResponse {
  return { rpcId: request.rpcId, result: { ok: false, error: { code: 'internal', message, details: {} } } }
}

/** Wrap the original handler so the configured policy determines the outcome. */
function wrapHandler(original: OpenPathHandler): OpenPathHandler {
  return async (request, signal) => {
    const rule = resolveRule(request.payload.path)
    if (rule === undefined || rule.action === 'default') {
      return original(request, signal)
    }
    try {
      applyAction(rule, request.payload.path)
      return opened(request)
    } catch (error) {
      return failed(request, error instanceof Error ? error.message : String(error))
    }
  }
}

/** This plugin must run after the api-proxy service provides `ctx.apiProxy`. */
export const inject = ['apiProxy']

/**
 * Wrap `ctx.apiProxy.host.openPath` for the lifetime of this plugin; the
 * disposer restores the original (a symlink-style reinstall of the profile
 * re-runs apply, so the restore keeps re-entry idempotent).
 * @param ctx - owning plugin context.
 */
export function apply(ctx: Context): void {
  const api = (ctx as unknown as { apiProxy: ApiProxyFace }).apiProxy
  const original = api.host.openPath
  ctx.effect(
    () => {
      api.host.openPath = wrapHandler(original)
      return () => { api.host.openPath = original }
    },
    'bc-file-open: openPath policy',
  )
}