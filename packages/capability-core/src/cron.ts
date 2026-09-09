/**
 * Cron engine of capability-core (P4-0): the JSON-backed task/run stores, the
 * cron-parser scheduler over `ctx.interval`, and the execution path that
 * creates a real agent session in the task's workspace, pins the unattended
 * permission pair, sends the prompt, and records the outcome.
 *
 * Execution recipe mirrors the official `session.create` wire mapping
 * (reference/upstream/packages/host/apiproxy/src/api-proxy.ts:2107-2180):
 * mint `session-<uuid>` → `ctx.workspaceRegistry.get(workspaceId)` →
 * `meta.cwd = workspace.path` → `ctx.agents.create` → `workspace.attachSession`.
 * The permission pair is pinned with the two canonical setters directly
 * (docs/04-spec 决策 18): `setSandboxMode(session, 'workspace-write')` +
 * `setApprovalPolicy(session, 'never')` — the resulting knob state matches no
 * preset table entry, i.e. the derived `custom` preset, exactly as the
 * unattended contract requires (fail-closed, approval `never` rejects before
 * dispatch).
 *
 * @module @bc-agent/capability-core/cron
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { CronExpressionParser, CronDate } from 'cron-parser'
import { setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy'
import { setApprovalPolicy } from '@deepseek-ai/dsh-user-approval'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId, SessionEvent } from '@deepseek-ai/dsh-session'
import type { Agent, AgentOptions } from '@deepseek-ai/dsh-agent'
import type { Workspace } from '@deepseek-ai/dsh-workspace'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import { dshHome, badRequest } from './skill-core.ts'

// ---------------------------------------------------------------------------
// stores
// ---------------------------------------------------------------------------

/** One stored cron task. */
export interface CronTask {
  id: string
  name: string
  description: string
  /** The instruction sent to the model when the task fires. */
  prompt: string
  cronExpression: string
  workspaceId: string
  /** Provider route (agentOptions.provider) when the task pins a model. */
  modelProvider: string
  /** Model id (agentOptions.model) when the task pins a model. */
  model: string
  enabled: boolean
  createdAt: string
}

/** Run outcome phases (the UI renders these verbatim). */
export type CronRunStatus = 'queued' | 'running' | 'success' | 'failed'
/** Who started the run. */
export type CronRunKind = 'manual' | 'scheduled'

/** One recorded run (newest first in the store). */
export interface CronRun {
  id: string
  taskId: string
  taskName: string
  kind: CronRunKind
  status: CronRunStatus
  triggeredAt: string
  /** The agent session the run executed in (absent when creation failed). */
  sessionId: string | undefined
  /** Failure message when the run did not succeed. */
  error: string | undefined
  finishedAt: string | undefined
}

function cronTasksPath(): string {
  return join(dshHome(), 'bc-cron-tasks.json')
}

function cronRunsPath(): string {
  return join(dshHome(), 'bc-cron-runs.json')
}

/** Read one JSON store file, tolerating a UTF-8 BOM (hand-edited stores). */
function readJsonStore(path: string): string {
  const raw = readFileSync(path, 'utf8')
  return raw.charCodeAt(0) === 0xFEFF ? raw.slice(1) : raw
}

/** Load stored tasks; pre-`prompt` stores default the new field to ''. */
export function loadCronTasks(): CronTask[] {
  try {
    const rows = JSON.parse(readJsonStore(cronTasksPath())) as Partial<CronTask>[]
    return rows.map(row => ({
      id: String(row.id ?? ''),
      name: String(row.name ?? ''),
      description: String(row.description ?? ''),
      prompt: String(row.prompt ?? ''),
      cronExpression: String(row.cronExpression ?? ''),
      workspaceId: String(row.workspaceId ?? ''),
      modelProvider: String(row.modelProvider ?? ''),
      model: String(row.model ?? ''),
      enabled: row.enabled !== false,
      createdAt: String(row.createdAt ?? ''),
    }))
  } catch {
    return []
  }
}

function saveCronTasks(tasks: CronTask[]): void {
  mkdirSync(dshHome(), { recursive: true })
  writeFileSync(cronTasksPath(), JSON.stringify(tasks, null, 2) + '\n')
}

/** Load recorded runs (newest first already in the file). */
export function loadCronRuns(): CronRun[] {
  try {
    return JSON.parse(readJsonStore(cronRunsPath())) as CronRun[]
  } catch {
    return []
  }
}

function saveCronRuns(runs: CronRun[]): void {
  mkdirSync(dshHome(), { recursive: true })
  writeFileSync(cronRunsPath(), JSON.stringify(runs, null, 2) + '\n')
}

/** Prepend one run record, cap the history at 200 entries (retention). */
function recordRun(run: CronRun): void {
  const runs = loadCronRuns()
  runs.unshift(run)
  saveCronRuns(runs.slice(0, 200))
}

/** Patch one run record in place (status transitions). */
function patchRun(id: string, patch: Partial<CronRun>): void {
  const runs = loadCronRuns()
  const index = runs.findIndex(run => run.id === id)
  if (index < 0) return
  runs[index] = { ...runs[index]!, ...patch }
  saveCronRuns(runs)
}

// ---------------------------------------------------------------------------
// task CRUD (/ext cron.tasks.*)
// ---------------------------------------------------------------------------

/** Extract the optional pinned model from a payload (empty strings → none). */
function modelOf(p: Partial<CronTask>): { modelProvider: string; model: string } {
  const provider = typeof p.modelProvider === 'string' ? p.modelProvider.trim() : ''
  const model = typeof p.model === 'string' ? p.model.trim() : ''
  return { modelProvider: provider, model }
}

export function createCronTask(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as Partial<CronTask>
  if (typeof p.name !== 'string' || p.name.trim() === '') return badRequest('cron.tasks.create requires name')
  if (typeof p.cronExpression !== 'string' || p.cronExpression.trim() === '') return badRequest('cron.tasks.create requires cronExpression')
  if (typeof p.workspaceId !== 'string' || p.workspaceId.trim() === '') return badRequest('cron.tasks.create requires workspaceId')
  if (typeof p.prompt !== 'string' || p.prompt.trim() === '') {
    if (typeof p.description !== 'string' || p.description.trim() === '') {
      return badRequest('cron.tasks.create requires prompt or description')
    }
  }
  const task: CronTask = {
    id: `cron-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: p.name.trim(),
    description: typeof p.description === 'string' ? p.description.trim() : '',
    prompt: typeof p.prompt === 'string' ? p.prompt.trim() : '',
    cronExpression: p.cronExpression.trim(),
    workspaceId: p.workspaceId.trim(),
    ...modelOf(p),
    enabled: typeof p.enabled === 'boolean' ? p.enabled : true,
    createdAt: new Date().toISOString(),
  }
  const tasks = loadCronTasks()
  tasks.push(task)
  saveCronTasks(tasks)
  return { ok: true, value: { ok: true, task } }
}

export function listCronTasks(): { ok: true; value: unknown } {
  const now = new Date()
  const tasks = loadCronTasks().map(task => ({
    ...task,
    // The scheduler's next occurrence, computed live so the UI can render
    // "下次" without owning a cron parser (invalid expressions → undefined).
    nextRunAt: nextRunAt(task.cronExpression, now)?.toISOString(),
  }))
  return { ok: true, value: { ok: true, tasks } }
}

export function updateCronTask(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as Partial<CronTask> & { id?: string }
  if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('cron.tasks.update requires id')
  const tasks = loadCronTasks()
  const index = tasks.findIndex(task => task.id === p.id)
  if (index < 0) return badRequest('cron.tasks.update unknown task id')
  const prev = tasks[index]!
  const name = typeof p.name === 'string' ? p.name.trim() : prev.name
  if (name === '') return badRequest('cron.tasks.update requires name')
  const cronExpression = typeof p.cronExpression === 'string' ? p.cronExpression.trim() : prev.cronExpression
  if (cronExpression === '') return badRequest('cron.tasks.update requires cronExpression')
  const workspaceId = typeof p.workspaceId === 'string' ? p.workspaceId.trim() : prev.workspaceId
  if (workspaceId === '') return badRequest('cron.tasks.update requires workspaceId')
  const prompt = typeof p.prompt === 'string' ? p.prompt.trim() : prev.prompt
  if (prompt === '' && typeof p.description === 'string' && p.description.trim() !== '') {
    // Create-time fallback: an edit that drops the prompt but keeps a
    // description keeps the task runnable (the executor falls back to it).
  }
  const updated: CronTask = {
    ...prev,
    name,
    description: typeof p.description === 'string' ? p.description.trim() : prev.description,
    prompt,
    cronExpression,
    workspaceId,
    ...modelOf(p),
    enabled: typeof p.enabled === 'boolean' ? p.enabled : prev.enabled,
  }
  tasks[index] = updated
  saveCronTasks(tasks)
  return { ok: true, value: { ok: true, task: updated } }
}

export function deleteCronTask(payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { id?: string }
  if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('cron.tasks.delete requires id')
  const tasks = loadCronTasks()
  const next = tasks.filter(task => task.id !== p.id)
  if (next.length === tasks.length) return badRequest('cron.tasks.delete unknown task id')
  saveCronTasks(next)
  return { ok: true, value: { ok: true } }
}

export function listCronRuns(): { ok: true; value: unknown } {
  return { ok: true, value: { ok: true, runs: loadCronRuns() } }
}

// ---------------------------------------------------------------------------
// templates (built-in preset roster)
// ---------------------------------------------------------------------------

/**
 * One built-in cron template (docs/spec-v0.8-archive/04-spec §4.2). Templates
 * are read-only examples that guide task creation: the UI pre-fills the task
 * form from one, and the user edits before creating. User-manageable
 * templates are deferred — the preset roster is a static constant (the
 * skill-market manifest posture), not a store.
 */
export interface CronTemplate {
  id: string
  name: string
  /** What the template does — card copy, and the pre-filled task description. */
  description: string
  /** The example instruction — pre-fills the task prompt. */
  prompt: string
  /** The default schedule — pre-fills the frequency picker. */
  defaultCronExpr: string
}

/**
 * The bundled roster (spec §4.2: 日报/周报/月度盘点). Name/description/prompt
 * are product content, not UI chrome, so they stay zh-only like the market
 * manifest entries. Every expression round-trips through the UI's cron
 * parser (parseCronExpression) — the frequency picker, never raw cron.
 */
export const BUILTIN_CRON_TEMPLATES: readonly CronTemplate[] = [
  {
    id: 'daily-report',
    name: '每日工作日报',
    description: '每个工作日傍晚自动总结当天工作内容，生成一份结构化日报。',
    prompt: '请查看当前工作区的文件与 git 变更，总结今天完成的工作、进行中的事项和遇到的问题，生成一份简洁的中文日报。',
    defaultCronExpr: '0 18 * * *',
  },
  {
    id: 'weekly-report',
    name: '每周工作周报',
    description: '每周五下班前汇总本周工作进展，生成周报草稿。',
    prompt: '请汇总本周的工作进展：完成的任务、关键产出、下周计划与风险，结合工作区内容生成一份中文周报。',
    defaultCronExpr: '0 17 * * 5',
  },
  {
    id: 'monthly-review',
    name: '月度工作盘点',
    description: '每月 1 日上午盘点上月工作成果，生成月度总结。',
    prompt: '请盘点本月的工作成果与经验教训：对比月初目标，总结关键产出、遇到的问题和可沉淀的经验，生成一份中文月度总结。',
    defaultCronExpr: '0 9 1 * *',
  },
]

/** List the built-in template roster (read-only; the UI fills the task form). */
export function listCronTemplates(): { ok: true; value: unknown } {
  return { ok: true, value: { ok: true, templates: BUILTIN_CRON_TEMPLATES } }
}

// ---------------------------------------------------------------------------
// scheduler
// ---------------------------------------------------------------------------

/**
 * The next occurrence of a cron expression at/after `now` in the machine's
 * LOCAL timezone (the picker's HH:MM values are the user's wall clock).
 * Undefined for invalid expressions.
 * @param expression - five-field cron expression.
 * @param now - the reference instant.
 * @returns the next run time, or undefined when the expression is invalid.
 */
export function nextRunAt(expression: string, now: Date): Date | undefined {
  try {
    // cron-parser v5 defaults the reference to UTC; pin the local zone so the
    // expression matches the wall clock the user picked. (The class is a
    // NAMED export: this package's CJS runtime default is a namespace object,
    // so a default import would silently lose the static `parse`.)
    return CronExpressionParser.parse(expression, { currentDate: new CronDate(now, 'local') }).next().toDate()
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// execution
// ---------------------------------------------------------------------------

/** The host services the executor needs (structural — provided by the plugin ctx). */
export interface CronHostServices {
  agents: {
    create(options: {
      sessionId: SessionId
      agentOptions?: AgentOptions
      meta?: { cwd?: string; agentPreset?: string }
      setup?(agentCtx: Context): Promise<void> | void
    }): Promise<{ agent: Agent; dispose(): Promise<void> }>
  }
  workspaceRegistry: {
    get(id: string): Workspace | undefined
  }
  /** The deployment default model selection (the official settings read). */
  defaultModel: {
    currentSelection(): { provider: string; model: string; reasoningEffort?: string }
  }
  /**
   * The preset roster that composes an agent's scoped world — the preset's own
   * `skill-filesystem`/`tool-skill` rows, which is what discovers a workspace's
   * project skills. Absent in a rosterless deployment (sessions share the host
   * composition only), so the executor treats it as optional.
   */
  agentPresets?: {
    mount(agentCtx: Context, presetId?: string): Promise<unknown>
  }
}

/** The turn outcome the last `turn/end` event reports (kind-discriminated). */
type TurnEndOutcome = { kind: string }

/** Fold the last turn outcome from the session log. */
function lastTurnReason(events: readonly SessionEvent[]): TurnEndOutcome | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]!
    if (event.type === 'turn/end') return event.data.reason
  }
  return undefined
}

/** Build the user message the executor sends (one text part, user source). */
function userText(text: string): UserMessage {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

/** One in-flight execution (concurrency guard). */
const running = new Set<string>()

/**
 * Execute one task end-to-end: create the agent session in the workspace,
 * pin the unattended permission pair, attach, prompt, await idle, fold the
 * turn outcome, dispose. Records every phase transition in the run store.
 * @param host - the agents/workspaceRegistry services.
 * @param task - the task to execute.
 * @param run - the already-recorded queued run (id/kind/triggeredAt).
 */
export async function executeTask(host: CronHostServices, task: CronTask, run: CronRun): Promise<void> {
  if (running.has(task.id)) return
  running.add(task.id)
  const workspace = host.workspaceRegistry.get(task.workspaceId)
  if (workspace === undefined) {
    patchRun(run.id, { status: 'failed', error: `workspace "${task.workspaceId}" not found`, finishedAt: new Date().toISOString() })
    running.delete(task.id)
    return
  }
  const sessionId = `session-${randomUUID()}` as SessionId
  try {
    patchRun(run.id, { status: 'running', sessionId })
    mkdirSync(workspace.path, { recursive: true })
    // Model resolution mirrors the official session.create recipe: a pinned
    // task model wins, otherwise the deployment default (the agent would
    // otherwise make its first request with no provider/model route and fail).
    const pinned = task.modelProvider !== '' && task.model !== ''
    const selection = pinned
      ? { provider: task.modelProvider, model: task.model }
      : host.defaultModel.currentSelection()
    const agentOptions: AgentOptions = { provider: selection.provider, model: selection.model }
    // Compose the agent through the preset roster, exactly like the official
    // `session.create` → `ensureSession` → `composeAgent` setup. Without this
    // setup the agent publishes into the empty global layer: the preset's
    // `skill-filesystem`/`tool-skill` rows never mount, so the session resolves
    // no project skills for its workspace (agent-presets logs a "published
    // without joining an agent preset" warning). A rosterless deployment skips
    // the mount and inherits the host composition, the pre-preset behavior.
    const presets = host.agentPresets
    const setup = presets === undefined ? undefined : async (agentCtx: Context) => {
      await presets.mount(agentCtx)
    }
    const handle = await host.agents.create({
      sessionId,
      agentOptions,
      meta: { cwd: workspace.path },
      ...setup === undefined ? {} : { setup },
    })
    const agent = handle.agent
    // Unattended permission pair (docs/04-spec 决策 18): the canonical
    // setters land the session in the derived 'custom' preset state
    // (workspace-write + never), never the bundled workspace-write preset
    // (which would carry 'ask'). 'never' rejects before dispatch, fail-closed.
    setSandboxMode(agent.session, 'workspace-write')
    setApprovalPolicy(agent.session, 'never')
    await workspace.attachSession(sessionId)
    const prompt = task.prompt !== '' ? task.prompt : task.description
    agent.followup(userText(prompt))
    await agent.whenIdle()
    const reason = lastTurnReason(agent.session.snapshotEvents())
    const ok = reason === undefined || reason.kind === 'completed'
    patchRun(run.id, {
      status: ok ? 'success' : 'failed',
      error: ok ? undefined : `turn ended with ${reason.kind}`,
      finishedAt: new Date().toISOString(),
    })
    await handle.dispose()
  } catch (error: unknown) {
    patchRun(run.id, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
      finishedAt: new Date().toISOString(),
    })
  } finally {
    running.delete(task.id)
  }
}

/** Fire one task now (manual run): queue + background execute. */
export function runCronTaskNow(host: CronHostServices, payload: unknown): { ok: true; value: unknown } | { ok: false; error: unknown } {
  const p = payload as { id?: string }
  if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('cron.tasks.run requires id')
  const task = loadCronTasks().find(item => item.id === p.id)
  if (task === undefined) return badRequest('cron.tasks.run unknown task id')
  if (running.has(task.id)) return badRequest('cron.tasks.run task already running')
  const run: CronRun = {
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    taskId: task.id,
    taskName: task.name,
    kind: 'manual',
    status: 'queued',
    triggeredAt: new Date().toISOString(),
    sessionId: undefined,
    error: undefined,
    finishedAt: undefined,
  }
  recordRun(run)
  void executeTask(host, task, run)
  return { ok: true, value: { ok: true, run } }
}

/** Per-task next-scheduled-run state (in-memory; recomputed from `now` at
 * every scheduler start, so missed runs while the desktop was closed are
 * skipped — the documented C7 constraint). */
export interface CronSchedulerState {
  nextByTask: Map<string, Date>
}

/** Fresh scheduler state (no task scheduled yet). */
export function createSchedulerState(): CronSchedulerState {
  return { nextByTask: new Map() }
}

/**
 * Tick the scheduler: for every enabled, not-running task, fire when its
 * tracked next-run time has passed, then schedule the following occurrence.
 * `next()` is always in the future, so the due test compares the TRACKED time
 * against `now`, never the freshly computed next (which would never be due).
 * @param host - the executor services.
 * @param state - the scheduler's per-task next-run table.
 */
export function tickScheduler(host: CronHostServices, state: CronSchedulerState): void {
  const now = new Date()
  for (const task of loadCronTasks()) {
    if (!task.enabled || running.has(task.id)) continue
    const scheduled = state.nextByTask.get(task.id)
    const next = nextRunAt(task.cronExpression, now)
    if (next === undefined) {
      state.nextByTask.delete(task.id)
      continue
    }
    const due = scheduled === undefined
      ? next.getTime() <= now.getTime() + 1_000
      : scheduled.getTime() <= now.getTime()
    if (due) {
      const run: CronRun = {
        id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        taskId: task.id,
        taskName: task.name,
        kind: 'scheduled',
        status: 'queued',
        triggeredAt: now.toISOString(),
        sessionId: undefined,
        error: undefined,
        finishedAt: undefined,
      }
      recordRun(run)
      // Model-visible ⟺ logged: scheduler fires are part of the app's
      // observable behavior, so they land on stderr with the run id.
      process.stderr.write(`bc-capability-core: cron fire task "${task.id}" -> run ${run.id}\n`)
      void executeTask(host, task, run)
    }
    state.nextByTask.set(task.id, next)
  }
}

/**
 * Start the scheduler tick. Fiber-bound via `ctx.interval` (the vendored
 * cordis timer plugin the dsh base mounts); 30-second granularity.
 * @param ctx - the plugin context (declares the timer mixin structurally to
 * avoid a hard dependency on the timer package's types).
 * @param host - the executor services.
 * @param state - the scheduler's per-task next-run table.
 * @returns the disposer.
 */
export function startCronScheduler(
  ctx: { interval(callback: () => void, delay: number): () => void },
  host: CronHostServices,
  state: CronSchedulerState,
): () => void {
  process.stderr.write(`bc-capability-core: cron scheduler started (${loadCronTasks().length} tasks, tick 30s)\n`)
  return ctx.interval(() => { tickScheduler(host, state) }, 30_000)
}
