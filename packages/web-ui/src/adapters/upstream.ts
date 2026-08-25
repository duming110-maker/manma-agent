/**
 * The official-domain single touchpoint of bc-web-ui (iron rule 2): every
 * official wire type this shell names, every read projection over official
 * state, and every service action against the official domains is defined
 * here. Nothing outside this module may import @deepseek-ai data faces or
 * invoke official services.
 *
 * Channel selection (the P2-b investigation finding): official client
 * plugins do NOT speak raw RPC from the browser. ui-workspace / ui-sidebar
 * consume the client runtime's object-layer services — `ctx.workspaces` /
 * `ctx.sessions`, provided by @deepseek-ai/dsh-client-runtime — whose live
 * snapshot stores carry the workspace.list + session.list baselines plus the
 * `host/archived-sessions-changed` stream. The framework hands every
 * root-scope slot component the standard selector hooks (useWorkspaces /
 * useSessions — the ui-layout AppFrame precedent), and per-registration
 * `inject` faces carry service actions (the ui-workspace precedent: its
 * sidebar wiring calls exactly ctx.sessions.open / ctx.workspaces.
 * archiveSession). This adapter follows both documented channels; the raw
 * /api envelope stays a host-side concern.
 *
 * Because the feeds are live stores, data refresh is event-driven for free:
 * initial load, the archive echo, and any other host-side change all arrive
 * through the same subscription the official sidebar uses. No polling.
 *
 * P2-c additions — the new-task flow's write half: IWorkspaces.
 * connectWorkspace is the documented New Session hand-off (blank-reuse else
 * host `session.create({ workspaceId })`, D7's cwd guarantee), and
 * ISession.prompt through ISessions.binding is the documented first-message
 * verb (one text part, 'queue' admission — the official ConversationController
 * .send shape). ISessions itself deliberately exposes no create: the
 * workspace-domain wrapper IS the official client-plugin channel.
 *
 * P2-d additions — the conversation header's halves: the write half is
 * ISession.rename (reached through ISessions.binding, the exact row→face hop
 * of the official ui-workspace renameSession wrapper; rename is a per-session
 * verb, not a list-service verb), whose success settles the 'title'
 * projection immediately so every list-row reader updates live. The read half
 * is projectSessionHeader: the current session's title/cwd plus its owning
 * workspace's title resolved from the account roster (workspace.sessionIds),
 * the same association the official grouping projection walks.
 *
 * P2-e additions — the skills page's read half: listSessionSkills wraps the
 * official connection service's skills face (ctx.connection.api.skills.list,
 * the `skill.list` RPC — the exact channel the official ui-skill '/' source
 * consumes; canonical contracts: reference/upstream/packages/client/connection/
 * src/client/index.ts ConnectionHandle + reference/upstream/packages/host/
 * apiproxy/src/api/skills.ts SkillsApi/SkillEntry). The wire face is named
 * here as a structural type (the carrier package is not a dependency of this
 * plugin; the adapter is the sanctioned home for official wire shapes). The
 * session coupling is the protocol's own (P0-4: sessionId is mandatory — the
 * host resolves the project root from the session header's cwd), so the
 * skills page lists the CURRENT session's catalog; the ui-skill guard is
 * mirrored (subagent-addressed sessions carry no user catalog).
 *
 * P2-f additions — the locale half (iron rule 4): the official LocaleRuntime
 * (ctx.locale, provided by dsh-client-locale) is consumed through the same
 * single point. Its setLocale is the ONLY preference write (the exact channel
 * of the official settings Language row — LocaleRuntime.setLocale →
 * locale.preference in the Host settings.yaml, so bc copy and official
 * components can never drift), and its snapshot surface is exposed through
 * the inject face's reserved hooks compartment (the renderer binds the
 * HostObservable into a useLocale selector hook; the render-side refresh
 * rides the snapshot revision, the same signal behind the `t` seat).
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ISessions, IWorkspaces, SessionId, SessionListState, SessionSummary, WorkspaceId,
  WorkspaceListState,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { HostObservable, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls the ctx.locale Context merge (the dsh-client-locale
// service face); cross-plugin collaboration goes through the service, never a
// value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-locale/client'

/**
 * The official standard-feed hooks this shell consumes. They arrive as
 * framework-injected props on every root-scope slot component (GlobalStandardProps
 * merge — the PropsRuntime share already carries them; this restatement is the
 * porting-discipline citation that keeps the official feed contract declared at
 * the single point that owns all other official types).
 */
export type UpstreamFeedProps = {
  /** Live session-list feed (rows + current selection). */
  useSessions: SnapshotSelectorHook<SessionListState>
  /** Live workspace-list feed (rows + registry-global archive set). */
  useWorkspaces: SnapshotSelectorHook<WorkspaceListState>
}

/**
 * The official session id under this shell's alias — the only spelling client
 * modules may name (P2-b review item: direct `SessionId` type-imports outside
 * the adapter are a porting-discipline deviation).
 */
export type UpstreamSessionId = SessionId
/** The official workspace id under the same alias regime. */
export type UpstreamWorkspaceId = WorkspaceId

/**
 * Service actions exposed to the sidebar (per-registration inject face; the
 * ui-workspace browserInjected precedent). Each member wraps one documented
 * service-method call — the whole official write surface of this card.
 */
export interface UpstreamFace {
  /**
   * Archive a session (IWorkspaces.archiveSession, D13): hidden from every
   * grouping surface, log and accounting slot kept, recoverable, idempotent.
   * The row disappears through the live store echo — no manual refresh.
   * @param sessionId - session to archive (registry-global; workspace
   * membership is not part of the official signature).
   */
  archiveSession(sessionId: SessionId): void
  /**
   * Start a New Session (IWorkspaces.startSession): connect the current or
   * recent workspace's blank session and open it — the official New Session
   * flow. The conversation surface follows the selection.
   */
  newSession(): void
  /**
   * Open the host's native directory picker for a local directory (used for
   * the skill-install source; IWorkspaces.pickDirectory).
   * @returns the selected absolute directory path, or null when the user cancels.
   */
  pickWorkspaceDirectory(): Promise<string | null>
  /**
   * Rename a session — the documented per-session verb ISession.rename,
   * reached through the ISessions binding (the official ui-workspace
   * renameSession wrapper's exact row→session-face hop). An explicit user
   * title pins it against automatic regeneration; success settles the
   * 'title' projection immediately, so the sidebar rows and this shell's
   * header (both read the same live store) update without a refresh.
   * @param sessionId - a listed session (binding-addressable).
   * @param title - raw title text (the host normalizes acceptance).
   * @throws when the session is not addressable or the rename is rejected.
   */
  renameSession(sessionId: SessionId, title: string): Promise<void>
  /**
   * List the user-invocable skill catalog of one session — the documented
   * `skill.list` RPC through the connection service's payload-direct api face
   * (the ui-skill consumption channel; the carrier mints the rpcId and parses
   * the value). Semantics are the protocol's own: the host resolves the
   * project root from the session header's cwd (project-level .agents/skills
   * plus the user-level roots), so the catalog is per-session; subagent-
   * addressed sessions carry no user catalog (the ui-skill guard, mirrored).
   * @param sessionId - a listed session (the current selection's id).
   * @returns the session's skill rows (name/description/whenToUse/user-only).
   * @throws when the RPC is rejected (transport failures also reject — the
   * caller owns the failure copy).
   */
  listSessionSkills(sessionId: SessionId): Promise<readonly UpstreamSkillEntry[]>
  /**
   * Switch the active UI locale — LocaleRuntime.setLocale, the official
   * preference write (persists as locale.preference in the Host settings
   * document; the official settings Language row writes through the same
   * verb, so both entries stay one source).
   * @param id - a registered locale id ('zh' | 'en'); unknown ids fail loud.
   */
  setLocale(id: 'zh' | 'en'): void
  /**
   * Switch the active UI theme — ThemeRuntime.setTheme, the official
   * preference write (persists the theme preference and republishes
   * `theme/change`, which re-runs this plugin's presenter so the OFFICIAL
   * conversation surface follows in the same step as the skeleton's own
   * token table; the official settings appearance row writes through the
   * same verb).
   * @param id - a builtin theme id ('light' | 'dark').
   */
  setTheme(id: 'light' | 'dark'): void
  /**
   * Install a local skill directory into the global or a project skill root
   * (host `skills.install` through the `/ext` channel).
   * @param opts - source dir + target (global | project) + workspace path (project only).
   * @returns the installed skill name + path.
   */
  installSkill(opts: { sourcePath: string; target: 'global' | 'project'; workspacePath?: string }): Promise<UpstreamSkillInstallResult>
  /** List the market catalog (host `skills.market.list`; bundled manifest). */
  listMarketSkills(): Promise<UpstreamMarketSkill[]>
  /** Install one market entry from GitHub (host `skills.market.install`). */
  installMarketSkill(input: { id: string; target: 'global' | 'project'; workspacePath?: string }): Promise<UpstreamSkillInstallResult>
  /** List the stored cron tasks (with live `nextRunAt`). */
  listCronTasks(): Promise<UpstreamCronTask[]>
  /** Create a cron task (P4: prompt + optional pinned model). */
  createCronTask(input: { name: string; description: string; prompt: string; cronExpression: string; workspaceId: string; modelProvider?: string; model?: string }): Promise<UpstreamCronTask>
  /** Patch one stored cron task (edit fields / flip the enabled flag). */
  updateCronTask(input: { id: string; name?: string; description?: string; prompt?: string; cronExpression?: string; workspaceId?: string; modelProvider?: string; model?: string; enabled?: boolean }): Promise<UpstreamCronTask>
  /** Remove one stored cron task. */
  deleteCronTask(id: string): Promise<void>
  /** Queue a real run of a stored task (host executes it in a session). */
  runCronTask(id: string): Promise<UpstreamCronRun>
  /** List the recorded runs (newest first). */
  listCronRuns(): Promise<UpstreamCronRun[]>
  /**
   * List the model catalog (host `llm.models` — session-independent groups
   * across every provider route), flattened to selectable options for the
   * cron form's model dropdown.
   */
  listModels(): Promise<readonly UpstreamModelOption[]>
  /**
   * Enumerate the installed skill roots (global + the given project roots),
   * each row carrying its install scope and on-disk path.
   * @param workspacePaths - the project roots to scan for project-scoped skills.
   */
  listInstalledSkills(workspacePaths: readonly string[]): Promise<UpstreamInstalledSkill[]>
  /** Remove one installed skill directory (global or project scope). */
  uninstallSkill(input: { name: string; scope: 'global' | 'project'; workspacePath?: string }): Promise<void>
  /** Rewrite one installed skill's description frontmatter field. */
  editSkill(input: { name: string; scope: 'global' | 'project'; workspacePath?: string; description: string }): Promise<void>
  /** Move one installed skill between install roots (the "edit install location" action). */
  moveSkill(input: { name: string; fromScope: 'global' | 'project'; fromWorkspacePath?: string; toScope: 'global' | 'project'; toWorkspacePath?: string }): Promise<void>
  /** Copy one installed skill to another root (no frontmatter re-validation; multi-target edit). */
  copySkill(input: { name: string; fromScope: 'global' | 'project'; fromWorkspacePath?: string; toScope: 'global' | 'project'; toWorkspacePath?: string }): Promise<void>
  /** Read the global-skills master switch (host `skills.state`; default off). */
  getGlobalSkillsState(): Promise<boolean>
  /** Write the global-skills master switch (host `skills.setState`). */
  setGlobalSkillsState(enabled: boolean): Promise<boolean>
  /** List the current workspaces from the official live store (the rules/memory form's scope dropdown). */
  listWorkspaces(): Promise<readonly UpstreamWorkspaceOption[]>
  /** List stored behavior rules (host `krm.rules.list`). */
  listRules(): Promise<UpstreamRule[]>
  /** Create a behavior rule (host `krm.rules.create`). */
  createRule(input: { name: string; content: string; enabled?: boolean }): Promise<UpstreamRule>
  /** Patch one stored rule (edit fields / flip the enabled flag). */
  updateRule(input: { id: string; name?: string; content?: string; enabled?: boolean }): Promise<UpstreamRule>
  /** Remove one stored rule. */
  deleteRule(id: string): Promise<void>
  /** List stored memories (host `krm.memories.list`; rows carry the resolved workspace title). */
  listMemories(): Promise<UpstreamMemory[]>
  /** Read the memory master switch (host `krm.memories.state`). */
  getMemoriesState(): Promise<boolean>
  /** Write the memory master switch (host `krm.memories.setState`). */
  setMemoriesState(enabled: boolean): Promise<boolean>
  /** Create a memory (four-type taxonomy; feedback forces why/howToApply). */
  createMemory(input: {
    name: string
    description?: string
    memoryType: UpstreamMemoryType
    enabled?: boolean
    content: string
    why?: string
    howToApply?: string
    scope: 'global' | 'workspace'
    workspaceId?: string
    freshnessWarningDays?: number
  }): Promise<UpstreamMemory>
  /** Patch one stored memory (missing fields keep current values). */
  updateMemory(input: {
    id: string
    name?: string
    description?: string
    memoryType?: UpstreamMemoryType
    enabled?: boolean
    content?: string
    why?: string
    howToApply?: string
    scope?: 'global' | 'workspace'
    workspaceId?: string
    freshnessWarningDays?: number
  }): Promise<UpstreamMemory>
  /** Remove one stored memory. */
  deleteMemory(id: string): Promise<void>
}

/**
 * The registration's full inject-factory return: the action face plus the
 * reserved hooks compartment (the render machinery binds the locale source
 * into a useLocale selector hook — the compartment never reaches a component
 * as a plain prop).
 */
export type UpstreamInjectFace = UpstreamFace & {
  hooks: { locale: HostObservable<UpstreamLocaleSnapshot> }
}

/**
 * Structural view of the official locale snapshot this shell consumes (the
 * LocaleSnapshot wire shape; named here per the adapter regime — the carrier
 * package is not a dependency of this plugin).
 */
export interface UpstreamLocaleSnapshot {
  /** Active locale id. */
  active: 'zh' | 'en'
  /** Selectable locales in display order (self-described labels). */
  locales: readonly { id: string; label: string }[]
  /** Monotonic change counter (registry or active-locale changes). */
  revision: number
}

/**
 * Structural view of the official LocaleRuntime this adapter touches (the
 * snapshot surface plus the preference write; the runtime additionally
 * carries register/bind, consumed by the plugin body's dictionary effect).
 */
interface LocaleServiceWireFace extends HostObservable<UpstreamLocaleSnapshot> {
  /**
   * Switch the active locale (the only preference write entry).
   * @param id - a registered locale id; unknown ids fail loud.
   */
  setLocale(id: string): void
}

/** One skill row of a session's catalog (the official SkillEntry wire projection). */
export interface UpstreamSkillEntry {
  /** Kebab-case identifier the user references as `/name` in the composer. */
  name: string
  /** Short routing description. */
  description: string
  /** Optional extra routing guidance (absent on the wire when unset). */
  whenToUse: string | undefined
  /** False marks a user-only skill (disable-model-invocation): invocable in the composer, absent from the model catalog. */
  modelInvocable: boolean
}

/** Result of a skill install (host echo of `skills.install`). */
export interface UpstreamSkillInstallResult {
  name: string
  installedPath: string
}

/** One stored cron task (P4: real scheduling; the executor reads prompt + model + workspace). */
export interface UpstreamCronTask {
  id: string
  name: string
  description: string
  /** The instruction sent to the model when the task fires. */
  prompt: string
  cronExpression: string
  workspaceId: string
  /** Provider route id when the task pins a model (empty = default). */
  modelProvider: string
  /** Model id when the task pins a model (empty = default). */
  model: string
  enabled: boolean
  createdAt: string
  /** The scheduler's next occurrence (host-computed; absent when invalid/disabled). */
  nextRunAt: string | undefined
}

/** One recorded cron run (real execution: queued → running → success/failed). */
export interface UpstreamCronRun {
  id: string
  taskId: string
  taskName: string
  kind: 'manual' | 'scheduled'
  status: 'queued' | 'running' | 'success' | 'failed'
  triggeredAt: string
  /** The agent session the run executed in (absent when creation failed). */
  sessionId: string | undefined
  /** Failure message when the run did not succeed. */
  error: string | undefined
  finishedAt: string | undefined
}

/** One market entry (docs/06-skill-standard §6; GitHub-sourced). */
export interface UpstreamMarketSkill {
  id: string
  name: string
  description: string
  whenToUse: string | undefined
  source: { type: 'github'; repo: string; ref: string; path: string }
  tags: string[] | undefined
  license: string | undefined
}

/** One selectable model option flattened from the host model catalog. */
export interface UpstreamModelOption {
  /** Provider route id (host-side request routing). */
  provider: string
  /** Provider-owned model id. */
  model: string
  /** Provider-supplied display name. */
  name: string
}

/** One installed skill row (global or project install root). */
export interface UpstreamInstalledSkill {
  name: string
  description: string
  whenToUse: string | undefined
  modelInvocable: boolean
  scope: 'global' | 'project'
  workspacePath: string | undefined
  installedPath: string
}

/** One stored behavior rule (P3a krm; global-only). */
export interface UpstreamRule {
  id: string
  name: string
  /** Free-text style/persona/tone guidance, kept verbatim (user content). */
  content: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** The four-type memory taxonomy (docs/04-spec §3.6, inherited from v0.8.1 §6). */
export type UpstreamMemoryType = 'user' | 'feedback' | 'project' | 'reference'

/** One stored memory (P3a krm). */
export interface UpstreamMemory {
  id: string
  /** Title: list scannability + index-injection relevance cue. */
  name: string
  /** Description: enters the memory index section. */
  description: string
  memoryType: UpstreamMemoryType
  /** Per-entry switch: disabled memories never enter the injection index. */
  enabled: boolean
  /** Markdown body (user content, not translated). */
  content: string
  /** Feedback-only (UI enforced). */
  why: string | undefined
  /** Feedback-only (UI enforced). */
  howToApply: string | undefined
  scope: 'global' | 'workspace'
  /** Official WorkspaceId when workspace-scoped. */
  workspaceId: string | undefined
  /** Freshness threshold in days (default 30; per-type presets project 7 / reference 90). */
  freshnessWarningDays: number
  lastAccessedAt: string | undefined
  createdAt: string
  updatedAt: string
  /** Host-resolved owning workspace title (absent for global rows). */
  workspaceTitle: string | undefined
}

/** The generic `/ext` channel call face (structural; the carrier package is not a dependency). */
type UpstreamExtCall = (channel: '/ext', endpoint: string, payload: unknown) => Promise<
  | { ok: true; value: unknown }
  | { ok: false; error: { code: string; message: string } }
>

/**
 * Structural view of the official connection service's skills face (iron rule
 * 2: the adapter names the official wire shapes; the carrier package is not a
 * dependency, so the face is described by shape — the ui-skill `ctx.get(
 * 'connection') as …` precedent — rather than by type-import).
 */
interface UpstreamSkillsWireFace {
  /**
   * The `skill.list` unary call, payload-direct form: the carrier mints the
   * rpcId, wraps the envelope, and parses the value schema.
   * @param payload - the session address (mandatory).
   * @param signal - optional cancellation (unused by this shell's page fetch).
   */
  list(payload: { sessionId: SessionId }, signal?: AbortSignal): Promise<{
    rpcId: unknown
    result:
      | { ok: true; value: { skills: readonly { name: string; description: string; whenToUse?: string; modelInvocable: boolean }[] } }
      | { ok: false; error: { code: string; message: string } }
  }>
}

/**
 * The `llm.models` unary call, payload-direct form — the session-independent
 * model catalog over every registered provider route (the same groups as
 * `session.models` without a per-session selection). Structural per the
 * adapter regime; the carrier package is not a dependency.
 */
interface UpstreamLlmWireFace {
  models(payload: Record<string, never>, signal?: AbortSignal): Promise<{
    rpcId: unknown
    result:
      | { ok: true; value: { groups: readonly UpstreamModelGroup[]; failures: readonly { id: string; name: string; message: string }[] } }
      | { ok: false; error: { code: string; message: string } }
  }>
}

/** One provider group of the host model catalog. */
interface UpstreamModelGroup {
  id: string
  name: string
  models: readonly { id: string; name: string; description?: string }[]
}

/** One sidebar session row projected from the official feeds. */
export interface UpstreamSessionRow {
  id: SessionId
  /** Blank rows carry the localized New-Session label (official rule). */
  title: string
  /** The provisional blank session (renderer may style it differently). */
  blank: boolean
  /** Epoch ms of the session's last activity. */
  updatedAt: number
}

/** One workspace group section in the sidebar. */
export interface UpstreamWorkspaceGroup {
  /** Render key: the workspace id, or '' for the ungrouped bucket. */
  key: string
  /** Group header label (workspace title; ungrouped label for the bucket). */
  label: string
  /** Visible rows in account order (ungrouped: recency order). */
  sessions: readonly UpstreamSessionRow[]
}

/** The sidebar's whole view of the official workspace/session domains. */
export interface UpstreamSidebarData {
  /** True until both official baselines (workspace.list + session.list) land. */
  loading: boolean
  /** Groups in host registry order; the ungrouped bucket trails when non-empty. */
  groups: readonly UpstreamWorkspaceGroup[]
}

/**
 * Visibility rule, ported from the official ui-workspace tree (sessionVisible):
 * subagent-origin rows use their parent catalogs, archived rows are hidden
 * everywhere (their accounting slots remain), and among blank rows only the
 * currently selected New Session placeholder stays visible.
 */
function sessionVisible(
  summary: SessionSummary, current: SessionId | undefined, archived: ReadonlySet<SessionId>,
): boolean {
  return summary.origin !== 'subagent'
    && !archived.has(summary.id)
    && (!summary.blank || summary.id === current)
}

/** Recency comparator (official byRecency): newest first, id as tiebreak. */
function byRecency(a: SessionSummary, b: SessionSummary): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : 1
}

/** Project one visible summary into the sidebar row shape. */
function toRow(summary: SessionSummary): UpstreamSessionRow {
  return {
    id: summary.id,
    title: summary.displayTitle,
    blank: summary.blank,
    updatedAt: summary.updatedAt,
  }
}

/**
 * Project the two official feed snapshots into the sidebar's grouped view —
 * the read half of this adapter. Semantics mirror the official
 * ui-workspace grouping (groupByWorkspace): one group per workspace in host
 * order with members resolved from `sessionIds` in account order, then an
 * ungrouped bucket (recency order) only when it has visible members.
 * Accounts may lead the list pull; a member without a summary row is
 * skipped until the summary lands (official behavior).
 * @param workspaces - workspace-list snapshot (items + archive set + readiness).
 * @param sessions - session-list snapshot (ids + byId + current).
 * @returns the sidebar data (loading flag + groups).
 */
export function projectSidebarData(
  workspaces: WorkspaceListState, sessions: SessionListState,
): UpstreamSidebarData {
  const archived = new Set(workspaces.archivedSessionIds)
  const groups: UpstreamWorkspaceGroup[] = []
  const accounted = new Set<SessionId>()
  for (const workspace of workspaces.items) {
    const rows: UpstreamSessionRow[] = []
    for (const id of workspace.sessionIds) {
      const summary = sessions.byId[id]
      if (summary === undefined) continue
      accounted.add(id)
      if (!sessionVisible(summary, sessions.current, archived)) continue
      rows.push(toRow(summary))
    }
    groups.push({ key: String(workspace.workspaceId), label: workspace.title, sessions: rows })
  }
  const stray = sessions.ids
    .map(id => sessions.byId[id])
    .filter((summary): summary is SessionSummary =>
      summary !== undefined && !accounted.has(summary.id)
      && sessionVisible(summary, sessions.current, archived))
    .sort(byRecency)
    .map(toRow)
  if (stray.length > 0) groups.push({ key: '', label: '', sessions: stray })
  return { loading: !workspaces.baselinesReady, groups }
}

/**
 * Relative-time bucket of a session row's trailing label — structured (unit +
 * magnitude) so the renderer localizes; a straight port of the official
 * relativeTime buckets.
 */
export type UpstreamRelativeTimeUnit = 'now' | 'minutes' | 'hours' | 'days' | 'months' | 'years'

/** Structured relative time (magnitude 0 for 'now'). */
export interface UpstreamRelativeTime {
  unit: UpstreamRelativeTimeUnit
  n: number
}

/**
 * Bucket an epoch-ms timestamp against now (official bucket boundaries).
 * @param updatedAt - epoch ms of the last activity.
 * @param now - current epoch ms (injected; pure derivation).
 * @returns the bucket and its magnitude.
 */
export function relativeTimeBucket(updatedAt: number, now: number): UpstreamRelativeTime {
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  const diff = Math.max(0, now - updatedAt)
  if (diff < MIN) return { unit: 'now', n: 0 }
  if (diff < HOUR) return { unit: 'minutes', n: Math.floor(diff / MIN) }
  if (diff < DAY) return { unit: 'hours', n: Math.floor(diff / HOUR) }
  if (diff < 30 * DAY) return { unit: 'days', n: Math.floor(diff / DAY) }
  if (diff < 365 * DAY) return { unit: 'months', n: Math.floor(diff / (30 * DAY)) }
  return { unit: 'years', n: Math.floor(diff / (365 * DAY)) }
}

/** One selectable workspace in the welcome view's dropdown. */
export interface UpstreamWorkspaceOption {
  id: WorkspaceId
  /** Display title (official row title; defaults to the path basename). */
  title: string
  /** Canonical directory path (official WorkspaceView.path). */
  path: string
}

/** The welcome view's whole view of the official workspace domain. */
export interface UpstreamWorkspaceOptions {
  /** True until the official workspace.list baseline lands. */
  loading: boolean
  /** Selectable workspaces in host registry order. */
  items: readonly UpstreamWorkspaceOption[]
  /**
   * Most recently active workspace (official recency projection) — the
   * welcome view's preselection target, falling back to the first item.
   */
  recentId: WorkspaceId | undefined
}

/**
 * Project the official workspace-list snapshot into the welcome dropdown's
 * options — the read half this card adds to the adapter.
 * @param workspaces - workspace-list snapshot (items + recency + readiness).
 * @returns the selectable options (loading flag + rows + preselect hint).
 */
export function projectWorkspaceOptions(
  workspaces: WorkspaceListState,
): UpstreamWorkspaceOptions {
  return {
    loading: !workspaces.baselinesReady,
    items: workspaces.items.map(item => ({ id: item.workspaceId, title: item.title, path: item.path })),
    recentId: workspaces.recentWorkspaceId,
  }
}

/** The conversation header's view of the current session (P2-d read half). */
export interface UpstreamSessionHeader {
  id: SessionId
  /**
   * Durable log-backed title, absent until the host projects one — the
   * in-place rename seeds this (not displayTitle: its id fallback would put a
   * session id into the edit box).
   */
  durableTitle: string | undefined
  /** Human-facing label: durable title, cwd basename, then session id. */
  displayTitle: string
  /** The provisional blank session (label shows the New-Session placeholder). */
  blank: boolean
  /** Canonical working directory, when the summary carries one. */
  cwd: string | undefined
  /**
   * Owning workspace's title (workspace.account membership, archived ids
   * included — slots are retained); undefined when the session is ungrouped,
   * where the badge falls back to the cwd basename.
   */
  workspaceTitle: string | undefined
}

/**
 * Project the two official feed snapshots into the conversation header's
 * current-session view. Undefined while no session is current or its summary
 * has not landed yet (the header renders nothing in that window — the frame's
 * no-current rule takes the main area back to the welcome view anyway).
 * @param workspaces - workspace-list snapshot (account roster for ownership).
 * @param sessions - session-list snapshot (current + summaries).
 * @returns the header data, or undefined with no current session.
 */
export function projectSessionHeader(
  workspaces: WorkspaceListState, sessions: SessionListState,
): UpstreamSessionHeader | undefined {
  const current = sessions.current
  if (current === undefined) return undefined
  const summary = sessions.byId[current]
  if (summary === undefined) return undefined
  const workspace = workspaces.items.find(item => item.sessionIds.includes(current))
  return {
    id: summary.id,
    durableTitle: summary.title,
    displayTitle: summary.displayTitle,
    blank: summary.blank,
    cwd: summary.cwd,
    workspaceTitle: workspace?.title,
  }
}

/**
 * Bind the official service faces into the shell's action surface. The
 * failure contract is the services' own: open fails loud on unknown ids,
 * archive rejections surface on the official list state, create/prompt
 * rejections propagate to the caller (the welcome view's failure state) —
 * all official behaviors, kept verbatim; the only local swallow is a console
 * warn on archive so a rejected archive never escalates to an unhandled
 * rejection.
 * @param ctx - client root context (sessions/workspaces/locale injected at apply).
 * @returns the inject face delivered to the shell frame component.
 */
export function createUpstreamFace(ctx: ClientContext): UpstreamInjectFace {
  const sessions = ctx.sessions satisfies ISessions
  const workspaces = ctx.workspaces satisfies IWorkspaces
  // The connection service (the wire root; the ui-skill/ui-settings-general
  // `ctx.get('connection') as …` precedent). Only its skills api face and the
  // generic /ext rpc caller are named.
  const connection = ctx.get('connection') as {
    api: { skills: UpstreamSkillsWireFace; llm: UpstreamLlmWireFace }
    rpc: { call: UpstreamExtCall }
  }
  const skills = connection.api.skills
  const llm = connection.api.llm
  const extCall = connection.rpc.call
  // The locale service (provided by dsh-client-locale; the Context merge is
  // type-only — never a value import). It doubles as the HostObservable the
  // hooks compartment exposes (getSnapshot + subscribe, structural).
  const locale: LocaleServiceWireFace = ctx.locale
  return {
    archiveSession: (sessionId) => {
      void workspaces.archiveSession(sessionId).catch((reason: unknown) => {
        console.warn('bc-web-ui: archive session rejected:', reason)
      })
    },
    pickWorkspaceDirectory: () => workspaces.pickDirectory(),
    newSession: () => { workspaces.startSession() },
    renameSession: async (sessionId, title) => {
      // Row → session-face hop: rename is a per-session verb (ISession), not
      // a list-service verb; the official ui-workspace wrapper's pattern kept
      // verbatim.
      const session = sessions.binding(sessionId)?.session
      if (session === undefined) {
        throw new Error(`bc-web-ui: session "${String(sessionId)}" is not addressable`)
      }
      const result = await session.rename(title)
      if (!result.ok) {
        throw new Error(`bc-web-ui: rename rejected: ${result.error.code}: ${result.error.message}`)
      }
    },
    listSessionSkills: async (sessionId) => {
      // Subagent-addressed sessions carry no user catalog (the ui-skill guard).
      if (sessions.subagentAddress(sessionId) !== undefined) return []
      const { result } = await skills.list({ sessionId })
      if (!result.ok) {
        throw new Error(`bc-web-ui: skill.list rejected: ${result.error.code}: ${result.error.message}`)
      }
      return result.value.skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        whenToUse: skill.whenToUse,
        modelInvocable: skill.modelInvocable,
      }))
    },
    setLocale: (id) => { locale.setLocale(id) },
    setTheme: (id) => { ctx.theme.setTheme(id) },
    installSkill: async (opts) => {
      const result = await extCall('/ext', 'skills.install', opts)
      if (!result.ok) throw new Error(`bc-web-ui: skills.install rejected: ${result.error.code}: ${result.error.message}`)
      return result.value as UpstreamSkillInstallResult
    },
    listMarketSkills: async () => {
      const result = await extCall('/ext', 'skills.market.list', {})
      if (!result.ok) throw new Error(`bc-web-ui: skills.market.list rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { version: number; skills: UpstreamMarketSkill[] }).skills
    },
    installMarketSkill: async (input) => {
      const result = await extCall('/ext', 'skills.market.install', input)
      if (!result.ok) throw new Error(`bc-web-ui: skills.market.install rejected: ${result.error.code}: ${result.error.message}`)
      return result.value as UpstreamSkillInstallResult
    },
    listCronTasks: async () => {
      const result = await extCall('/ext', 'cron.tasks.list', {})
      if (!result.ok) throw new Error(`bc-web-ui: cron.tasks.list rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; tasks: UpstreamCronTask[] }).tasks
    },
    createCronTask: async (input) => {
      const result = await extCall('/ext', 'cron.tasks.create', input)
      if (!result.ok) throw new Error(`bc-web-ui: cron.tasks.create rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; task: UpstreamCronTask }).task
    },
    updateCronTask: async (input) => {
      const result = await extCall('/ext', 'cron.tasks.update', input)
      if (!result.ok) throw new Error(`bc-web-ui: cron.tasks.update rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; task: UpstreamCronTask }).task
    },
    deleteCronTask: async (id) => {
      const result = await extCall('/ext', 'cron.tasks.delete', { id })
      if (!result.ok) throw new Error(`bc-web-ui: cron.tasks.delete rejected: ${result.error.code}: ${result.error.message}`)
    },
    runCronTask: async (id) => {
      const result = await extCall('/ext', 'cron.tasks.run', { id })
      if (!result.ok) throw new Error(`bc-web-ui: cron.tasks.run rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; run: UpstreamCronRun }).run
    },
    listCronRuns: async () => {
      const result = await extCall('/ext', 'cron.runs.list', {})
      if (!result.ok) throw new Error(`bc-web-ui: cron.runs.list rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; runs: UpstreamCronRun[] }).runs
    },
    listModels: async () => {
      const { result } = await llm.models({})
      if (!result.ok) {
        throw new Error(`bc-web-ui: llm.models rejected: ${result.error.code}: ${result.error.message}`)
      }
      const options: UpstreamModelOption[] = []
      for (const group of result.value.groups) {
        for (const model of group.models) {
          options.push({ provider: group.id, model: model.id, name: model.name || model.id })
        }
      }
      return options
    },
    listInstalledSkills: async (workspacePaths) => {
      const result = await extCall('/ext', 'skills.list', { workspacePaths })
      if (!result.ok) throw new Error(`bc-web-ui: skills.list rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; skills: UpstreamInstalledSkill[] }).skills
    },
    uninstallSkill: async (input) => {
      const result = await extCall('/ext', 'skills.uninstall', input)
      if (!result.ok) throw new Error(`bc-web-ui: skills.uninstall rejected: ${result.error.code}: ${result.error.message}`)
    },
    editSkill: async (input) => {
      const result = await extCall('/ext', 'skills.edit', input)
      if (!result.ok) throw new Error(`bc-web-ui: skills.edit rejected: ${result.error.code}: ${result.error.message}`)
    },
    moveSkill: async (input) => {
      const result = await extCall('/ext', 'skills.move', input)
      if (!result.ok) throw new Error(`bc-web-ui: skills.move rejected: ${result.error.code}: ${result.error.message}`)
    },
    copySkill: async (input) => {
      const result = await extCall('/ext', 'skills.copy', input)
      if (!result.ok) throw new Error(`bc-web-ui: skills.copy rejected: ${result.error.code}: ${result.error.message}`)
    },
    getGlobalSkillsState: async () => {
      const result = await extCall('/ext', 'skills.state', {})
      if (!result.ok) throw new Error(`bc-web-ui: skills.state rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; enabled: boolean }).enabled
    },
    setGlobalSkillsState: async (enabled) => {
      const result = await extCall('/ext', 'skills.setState', { enabled })
      if (!result.ok) throw new Error(`bc-web-ui: skills.setState rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; enabled: boolean }).enabled
    },
    // Rules + memories (P3a krm) — the workspace list reads the official live
    // store snapshot (the shell frame's useWorkspaces projection), not /ext.
    listWorkspaces: () => Promise.resolve(projectWorkspaceOptions(workspaces.list.getSnapshot()).items),
    listRules: async () => {
      const result = await extCall('/ext', 'krm.rules.list', {})
      if (!result.ok) throw new Error(`bc-web-ui: krm.rules.list rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; rules: UpstreamRule[] }).rules
    },
    createRule: async (input) => {
      const result = await extCall('/ext', 'krm.rules.create', input)
      if (!result.ok) throw new Error(`bc-web-ui: krm.rules.create rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; rule: UpstreamRule }).rule
    },
    updateRule: async (input) => {
      const result = await extCall('/ext', 'krm.rules.update', input)
      if (!result.ok) throw new Error(`bc-web-ui: krm.rules.update rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; rule: UpstreamRule }).rule
    },
    deleteRule: async (id) => {
      const result = await extCall('/ext', 'krm.rules.delete', { id })
      if (!result.ok) throw new Error(`bc-web-ui: krm.rules.delete rejected: ${result.error.code}: ${result.error.message}`)
    },
    listMemories: async () => {
      const result = await extCall('/ext', 'krm.memories.list', {})
      if (!result.ok) throw new Error(`bc-web-ui: krm.memories.list rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; memories: UpstreamMemory[] }).memories
    },
    getMemoriesState: async () => {
      const result = await extCall('/ext', 'krm.memories.state', {})
      if (!result.ok) throw new Error(`bc-web-ui: krm.memories.state rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; enabled: boolean }).enabled
    },
    setMemoriesState: async (enabled) => {
      const result = await extCall('/ext', 'krm.memories.setState', { enabled })
      if (!result.ok) throw new Error(`bc-web-ui: krm.memories.setState rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; enabled: boolean }).enabled
    },
    createMemory: async (input) => {
      const result = await extCall('/ext', 'krm.memories.create', input)
      if (!result.ok) throw new Error(`bc-web-ui: krm.memories.create rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; memory: UpstreamMemory }).memory
    },
    updateMemory: async (input) => {
      const result = await extCall('/ext', 'krm.memories.update', input)
      if (!result.ok) throw new Error(`bc-web-ui: krm.memories.update rejected: ${result.error.code}: ${result.error.message}`)
      return (result.value as { ok: true; memory: UpstreamMemory }).memory
    },
    deleteMemory: async (id) => {
      const result = await extCall('/ext', 'krm.memories.delete', { id })
      if (!result.ok) throw new Error(`bc-web-ui: krm.memories.delete rejected: ${result.error.code}: ${result.error.message}`)
    },
    hooks: { locale },
  }
}
