/**
 * Host half of @bc-agent/capability-core: owns the single `/ext` business RPC
 * channel (registered through the documented `ctx.connection.rpc.handle`) and
 * dispatches its endpoints. Inherits the official browser-trust fence with
 * zero fence code of ours.
 *
 * Endpoints (all loopback-only):
 * - `ext.probe`            echo (spike feasibility probe)
 * - `skills.install`       copy a local skill directory into the global or a
 *                          project skill root (P1-4 MVP; the real install flow
 *                          moves to capability-skillx later)
 * - `skills.list`          enumerate the global + project install roots
 * - `skills.uninstall`     remove one installed skill directory
 * - `skills.edit`          rewrite a skill's `description` frontmatter field
 * - `cron.tasks.create`    append a task to the JSON-backed task store
 * - `cron.tasks.list`      read the task store
 * - `cron.tasks.update`    patch one stored task (edit / enable toggle)
 * - `cron.tasks.delete`    remove one stored task
 * - `cron.tasks.run`       record a manual run in the run-history store
 * - `cron.runs.list`       read the run-history store
 *
 * MVP storage: cron tasks live in a JSON file under `$DSH_HOME` (survives
 * restart; the real capability-cron will move to `ctx.storage` domain +
 * cron-parser scheduling). Skill install copies the picked directory verbatim.
 *
 * @module @bc-agent/capability-core
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { homedir } from 'node:os'

/** The dedicated business RPC channel (03-architecture D3'); `/api` is reserved. */
const EXT_CHANNEL = '/ext'

/** Wait for the connection service: the channel registry lives on it. */
export const inject = ['connection']

/** Business error in the envelope's documented shape. */
function badRequest(message: string): { ok: false; error: { code: string; message: string; details: { issues: [] } } } {
  return { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } }
}

/** Resolve the effective DSH home (per-brand dir when DSH_HOME is set). */
function dshHome(): string {
  return process.env.DSH_HOME || join(homedir(), '.dsh')
}

// ---------------------------------------------------------------------------
// skills.install
// ---------------------------------------------------------------------------

/** Read one single-line frontmatter field (`key: value`, optional quotes). */
function skillField(text: string, key: string): string | undefined {
  const m = new RegExp(`^${key}:\\s*["']?([^"'\\n]+)["']?\\s*$`, 'm').exec(text)
  return m?.[1]?.trim() || undefined
}

/** Extract the skill name from SKILL.md frontmatter (`name:`), else the dir basename. */
function skillNameFrom(dir: string): string {
  const md = join(dir, 'SKILL.md')
  if (!existsSync(md)) return basename(dir)
  return skillField(readFileSync(md, 'utf8'), 'name') || basename(dir)
}

/** One parsed installed skill (SKILL.md metadata + install scope + on-disk path). */
interface InstalledSkillRow {
  name: string
  description: string
  whenToUse: string | undefined
  modelInvocable: boolean
  scope: 'global' | 'project'
  workspacePath: string | undefined
  installedPath: string
}

/** Parse one installed skill directory; undefined when it carries no SKILL.md. */
function skillInfoFrom(dir: string): Omit<InstalledSkillRow, 'scope' | 'workspacePath' | 'installedPath'> | undefined {
  const md = join(dir, 'SKILL.md')
  if (!existsSync(md)) return undefined
  const text = readFileSync(md, 'utf8')
  return {
    name: skillField(text, 'name') || basename(dir),
    description: skillField(text, 'description') || '',
    whenToUse: skillField(text, 'whenToUse'),
    modelInvocable: !/^disable-model-invocation:\s*(true|yes|on|1)\s*$/im.test(text),
  }
}

/** Immediate subdirectories of a skill root (missing root → no entries). */
function listSkillDirs(root: string): string[] {
  if (!existsSync(root)) return []
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(root, entry.name))
}

/** Resolve the install root for a global/project target (mirrors `skills.install`). */
function skillTargetDir(scope: 'global' | 'project', workspacePath: string | undefined): string {
  return scope === 'global' ? join(dshHome(), 'skills') : join(workspacePath as string, '.agents', 'skills')
}

function installSkill(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { sourcePath?: string; target?: string; workspacePath?: string }
  if (typeof p.sourcePath !== 'string' || p.sourcePath.trim() === '') return badRequest('skills.install requires sourcePath')
  if (p.target !== 'global' && p.target !== 'project') return badRequest('skills.install requires target "global" | "project"')
  if (p.target === 'project' && (typeof p.workspacePath !== 'string' || p.workspacePath.trim() === '')) {
    return badRequest('skills.install project target requires workspacePath')
  }
  if (!existsSync(join(p.sourcePath, 'SKILL.md'))) return badRequest(`no SKILL.md found under ${p.sourcePath}`)
  const name = skillNameFrom(p.sourcePath)
  const targetDir = p.target === 'global'
    ? join(dshHome(), 'skills')
    : join(p.workspacePath as string, '.agents', 'skills')
  const installedPath = join(targetDir, name)
  mkdirSync(targetDir, { recursive: true })
  cpSync(p.sourcePath, installedPath, { recursive: true })
  return { ok: true, value: { ok: true, name, installedPath } }
}

/** Validate a skill edit/uninstall address and return its target dir (or a badRequest result). */
function skillAddress(name: string | undefined, scope: string | undefined, workspacePath: string | undefined):
  | { ok: true; targetDir: string }
  | { ok: false; error: unknown } {
  if (typeof name !== 'string' || name.trim() === '') return badRequest('skill operation requires name')
  if (scope !== 'global' && scope !== 'project') return badRequest('skill operation requires scope "global" | "project"')
  if (scope === 'project' && (typeof workspacePath !== 'string' || workspacePath.trim() === '')) {
    return badRequest('skill operation with project scope requires workspacePath')
  }
  const targetDir = skillTargetDir(scope, workspacePath)
  if (dirname(join(targetDir, name.trim())) !== targetDir) return badRequest('skill operation name must be a single path segment')
  return { ok: true, targetDir }
}

function listSkills(payload: unknown): { ok: true; value: unknown } {
  const p = payload as { workspacePaths?: unknown }
  const paths = Array.isArray(p.workspacePaths)
    ? p.workspacePaths.filter((item): item is string => typeof item === 'string')
    : []
  const rows: InstalledSkillRow[] = []
  for (const dir of listSkillDirs(join(dshHome(), 'skills'))) {
    const info = skillInfoFrom(dir)
    if (info !== undefined) rows.push({ ...info, scope: 'global', workspacePath: undefined, installedPath: dir })
  }
  for (const workspacePath of paths) {
    for (const dir of listSkillDirs(join(workspacePath, '.agents', 'skills'))) {
      const info = skillInfoFrom(dir)
      if (info !== undefined) rows.push({ ...info, scope: 'project', workspacePath, installedPath: dir })
    }
  }
  rows.sort((a, b) => a.name.localeCompare(b.name))
  return { ok: true, value: { ok: true, skills: rows } }
}

function uninstallSkill(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { name?: string; scope?: string; workspacePath?: string }
  const address = skillAddress(p.name, p.scope, p.workspacePath)
  if (!address.ok) return address
  rmSync(join(address.targetDir, p.name!.trim()), { recursive: true, force: true })
  return { ok: true, value: { ok: true } }
}

/** YAML-safe single-line scalar for a frontmatter rewrite. */
function yamlScalar(value: string): string {
  const single = value.replace(/\r?\n/g, ' ').trim()
  return /^[A-Za-z0-9_./,()\- \u4e00-\u9fff]+$/.test(single) && !single.includes('#') ? single : JSON.stringify(single)
}

/** Set a single-line frontmatter field in place, inserting it after `name:` when absent. */
function setFrontmatterField(raw: string, key: string, value: string): string {
  const lines = raw.split('\n')
  const line = (i: number): string => lines[i] ?? ''
  if (line(0).replace(/\r$/, '') !== '---') return raw
  let close = -1
  for (let i = 1; i < lines.length; i += 1) {
    if (line(i).replace(/\r$/, '') === '---') { close = i; break }
  }
  if (close < 0) return raw
  const field = new RegExp(`^${key}:`)
  for (let i = 1; i < close; i += 1) {
    if (field.test(line(i).replace(/\r$/, ''))) {
      lines[i] = `${key}: ${yamlScalar(value)}`
      return lines.join('\n')
    }
  }
  let insertAt = close
  for (let i = 1; i < close; i += 1) {
    if (/^name:/.test(line(i).replace(/\r$/, ''))) { insertAt = i + 1; break }
  }
  lines.splice(insertAt, 0, `${key}: ${yamlScalar(value)}`)
  return lines.join('\n')
}

function editSkill(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { name?: string; scope?: string; workspacePath?: string; description?: string }
  const address = skillAddress(p.name, p.scope, p.workspacePath)
  if (!address.ok) return address
  const md = join(address.targetDir, p.name!.trim(), 'SKILL.md')
  if (!existsSync(md)) return badRequest('skill operation target has no SKILL.md')
  const raw = readFileSync(md, 'utf8')
  writeFileSync(md, setFrontmatterField(raw, 'description', typeof p.description === 'string' ? p.description : ''))
  return { ok: true, value: { ok: true } }
}

// ---------------------------------------------------------------------------
// cron.tasks
// ---------------------------------------------------------------------------

/** One stored cron task (MVP shape; real model in 04-spec §4.3). */
interface CronTask {
  id: string
  name: string
  description: string
  cronExpression: string
  workspaceId: string
  modelName: string
  enabled: boolean
  createdAt: string
}

/** One recorded run (manual trigger; real scheduling lands in P4). */
interface CronRun {
  id: string
  taskId: string
  taskName: string
  triggeredAt: string
}

function cronStorePath(): string {
  return join(dshHome(), 'bc-cron-tasks.json')
}

function loadCronTasks(): CronTask[] {
  try {
    const rows = JSON.parse(readFileSync(cronStorePath(), 'utf8')) as CronTask[]
    // Pre-`enabled` stores lack the flag; default those rows to enabled.
    return rows.map(row => ({ ...row, enabled: row.enabled !== false }))
  } catch {
    return []
  }
}

function saveCronTasks(tasks: CronTask[]): void {
  mkdirSync(dshHome(), { recursive: true })
  writeFileSync(cronStorePath(), JSON.stringify(tasks, null, 2) + '\n')
}

function createCronTask(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as Partial<CronTask>
  if (typeof p.name !== 'string' || p.name.trim() === '') return badRequest('cron.tasks.create requires name')
  if (typeof p.cronExpression !== 'string' || p.cronExpression.trim() === '') return badRequest('cron.tasks.create requires cronExpression')
  if (typeof p.workspaceId !== 'string' || p.workspaceId.trim() === '') return badRequest('cron.tasks.create requires workspaceId')
  const task: CronTask = {
    id: `cron-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: p.name.trim(),
    description: typeof p.description === 'string' ? p.description : '',
    cronExpression: p.cronExpression.trim(),
    workspaceId: p.workspaceId,
    modelName: typeof p.modelName === 'string' ? p.modelName : '',
    enabled: typeof p.enabled === 'boolean' ? p.enabled : true,
    createdAt: new Date().toISOString(),
  }
  const tasks = loadCronTasks()
  tasks.push(task)
  saveCronTasks(tasks)
  return { ok: true, value: { ok: true, task } }
}

function listCronTasks(): { ok: true; value: unknown } {
  return { ok: true, value: { ok: true, tasks: loadCronTasks() } }
}

function updateCronTask(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as Partial<CronTask> & { id?: string }
  if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('cron.tasks.update requires id')
  const tasks = loadCronTasks()
  const index = tasks.findIndex(task => task.id === p.id)
  if (index < 0) return badRequest('cron.tasks.update unknown task id')
  const prev = tasks[index]
  if (prev === undefined) return badRequest('cron.tasks.update unknown task id')
  const name = typeof p.name === 'string' ? p.name.trim() : prev.name
  if (name === '') return badRequest('cron.tasks.update requires name')
  const cronExpression = typeof p.cronExpression === 'string' ? p.cronExpression.trim() : prev.cronExpression
  if (cronExpression === '') return badRequest('cron.tasks.update requires cronExpression')
  const workspaceId = typeof p.workspaceId === 'string' ? p.workspaceId : prev.workspaceId
  if (workspaceId === '') return badRequest('cron.tasks.update requires workspaceId')
  const updated: CronTask = {
    ...prev,
    name,
    description: typeof p.description === 'string' ? p.description : prev.description,
    cronExpression,
    workspaceId,
    modelName: typeof p.modelName === 'string' ? p.modelName : prev.modelName,
    enabled: typeof p.enabled === 'boolean' ? p.enabled : prev.enabled,
  }
  tasks[index] = updated
  saveCronTasks(tasks)
  return { ok: true, value: { ok: true, task: updated } }
}

function deleteCronTask(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { id?: string }
  if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('cron.tasks.delete requires id')
  const tasks = loadCronTasks()
  const next = tasks.filter(task => task.id !== p.id)
  if (next.length === tasks.length) return badRequest('cron.tasks.delete unknown task id')
  saveCronTasks(next)
  return { ok: true, value: { ok: true } }
}

function cronRunsPath(): string {
  return join(dshHome(), 'bc-cron-runs.json')
}

function loadCronRuns(): CronRun[] {
  try {
    return JSON.parse(readFileSync(cronRunsPath(), 'utf8')) as CronRun[]
  } catch {
    return []
  }
}

function saveCronRuns(runs: CronRun[]): void {
  mkdirSync(dshHome(), { recursive: true })
  writeFileSync(cronRunsPath(), JSON.stringify(runs, null, 2) + '\n')
}

function runCronTask(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { id?: string }
  if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('cron.tasks.run requires id')
  const task = loadCronTasks().find(item => item.id === p.id)
  if (task === undefined) return badRequest('cron.tasks.run unknown task id')
  const run: CronRun = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId: task.id,
    taskName: task.name,
    triggeredAt: new Date().toISOString(),
  }
  const runs = loadCronRuns()
  runs.unshift(run)
  saveCronRuns(runs)
  return { ok: true, value: { ok: true, run } }
}

function listCronRuns(): { ok: true; value: unknown } {
  return { ok: true, value: { ok: true, runs: loadCronRuns() } }
}

// ---------------------------------------------------------------------------
// channel
// ---------------------------------------------------------------------------

/**
 * Dispatch one `/ext` endpoint. Unknown endpoints answer the envelope's
 * business-error branch without leaking anything beyond the endpoint name.
 * @param endpoint - endpoint segment(s) under `/ext/`.
 * @param payload - decoded envelope payload.
 * @returns the RpcResult value.
 */
const handleExt: ConnectionRpcHandler = async (endpoint, payload) => {
  switch (endpoint) {
    case 'ext.probe':
      return { ok: true, value: { ok: true, channel: 'ext', pong: payload } }
    case 'skills.install':
      return installSkill(payload) as never
    case 'skills.list':
      return listSkills(payload) as never
    case 'skills.uninstall':
      return uninstallSkill(payload) as never
    case 'skills.edit':
      return editSkill(payload) as never
    case 'cron.tasks.create':
      return createCronTask(payload) as never
    case 'cron.tasks.list':
      return listCronTasks() as never
    case 'cron.tasks.update':
      return updateCronTask(payload) as never
    case 'cron.tasks.delete':
      return deleteCronTask(payload) as never
    case 'cron.tasks.run':
      return runCronTask(payload) as never
    case 'cron.runs.list':
      return listCronRuns() as never
    default:
      return badRequest(`unknown /ext endpoint ${JSON.stringify(endpoint)}`) as never
  }
}

/**
 * Register the `/ext` channel with loopback-only authority (iron rule 6).
 * @param ctx - owning plugin context.
 */
export function apply(ctx: Context): void {
  ctx.effect(
    () => ctx.connection.rpc.handle(EXT_CHANNEL, handleExt, { authority: 'loopback' }),
    'bc-capability-core: /ext rpc channel',
  )
}
