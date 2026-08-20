/**
 * capability-krm（P3a）—— 规则 + 记忆 的存储域、CRUD 与注入链路。
 *
 * 存储：经 `ctx.storageDomain.open` 打开 `bc-krm` 域（name + version + 两阶段
 * 写的标准 domain 机制，docs/04-spec D4 / §4.6）：`rules` / `memories` 两表，
 * zod 校验每条记录的持久边界，读走内存（`KvTable.get/entries` 同步）、写走
 * `put/delete`（写穿 + 变更事件），单机量级下全量驻留即可。
 *
 * 注入：两条 system-prompt 接缝（docs/04-spec §6，决策 16）——
 * - 规则段经 `systemPrompt.section()` 贡献为 system prompt 静态段：仅全局、
 *   取 enabled 规则拼接为「行为规则」段（规则低频变化，进 section 不污染
 *   runtime-context）。
 * - 记忆索引经 `systemPrompt.context()` 贡献为 user-role runtime-context
 *   快照：按会话绑定工作区过滤（全局 + 该工作区），动态拼接「记忆索引」段
 *   （名称 + 类型 + 描述，超期条目附新鲜度警告，docs/04-spec §3.6）。索引
 *   按（工作区 + 写入版本）memoize，避免每 step 重算（docs/04-spec §6.1）。
 *
 * 作用域判定（V2 验证项）：`AssembleContext.agent`（dsh-agent 已声明该字段）
 * → `session.header.cwd` → `workspaceRegistry.list()` 反查工作区（精确匹配
 * 优先，路径前缀兜底）。会话必属工作区（无自由任务，决策 9），无工作区命中
 * 时只注入全局条目。
 *
 * @module @bc-agent/capability-core/krm
 */

import { z } from 'zod'
import type { Context } from '@deepseek-ai/cordis'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { DomainGlobal, KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { AssembleContext } from '@deepseek-ai/dsh-system-prompt'
import type { Workspace, WorkspaceId, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import { badRequest } from './skill-core.ts'

// ---------------------------------------------------------------------------
// 存储域（docs/04-spec §4.6）
// ---------------------------------------------------------------------------

/** 规则记录：名称 + 内容（对 AI 的风格/人设/语气要求）+ 启用开关。仅全局。 */
export const ruleRecord = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  /** 旧记录缺省 enabled 时默认启用（持久边界的向前兼容）。 */
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** 一条规则记录（`z.infer` 与 schema 同源，不重复书写）。 */
export type RuleRecord = z.infer<typeof ruleRecord>

/** 记忆四类型（docs/04-spec §3.6，继承 v0.8.1 §6 分类体系）。 */
export const MEMORY_TYPES = ['user', 'feedback', 'project', 'reference'] as const
/** 记忆类型字面量。 */
export type MemoryType = (typeof MEMORY_TYPES)[number]

/** 按类型的默认新鲜度阈值（天；docs/04-spec §3.6：project 7 / reference 90 / 其余 30）。 */
export const MEMORY_TYPE_FRESHNESS: Record<MemoryType, number> = {
  user: 30,
  feedback: 30,
  project: 7,
  reference: 90,
}

/** 记忆标题归一化（去重键）：去首尾空白、ASCII 小写、折叠内部连续空白。 */
function normalizeMemoryTitle(title: string): string {
  return title.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** 经典编辑距离（莱文斯坦），供标题近似去重。 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  let prev = Array.from({ length: n + 1 }, (_, j) => j)
  let curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[n]!
}

/** AI 自动沉淀记忆的输入（模型面工具的参数字段）。 */
export interface MemoryWriteInput {
  name: string
  content: string
  memoryType: MemoryType
  description?: string
  why?: string
  howToApply?: string
}

/** 自动沉淀记忆的写结果（工具回给模型的结构化值）。 */
export interface MemoryWriteResult {
  id: string
  name: string
  created: boolean
  scope: 'global' | 'workspace'
  message: string
}

/** 记忆作用域：全局 / 指定工作区。 */
export const memoryScope = z.enum(['global', 'workspace'])

/** 记忆记录（docs/04-spec §4.6 memories 表）。 */
export const memoryRecord = z.object({
  id: z.string(),
  /** name = 标题：列表可扫读 + 索引注入段供 AI 快速判断相关性。 */
  name: z.string(),
  /** 描述：进索引段。 */
  description: z.string(),
  memoryType: z.enum(MEMORY_TYPES),
  /** 单条启用开关：停用的记忆不进注入索引段（与规则语义一致）。 */
  enabled: z.boolean().default(true),
  /** Markdown 正文。 */
  content: z.string(),
  /** feedback 专属（UI 强制）。 */
  why: z.string().optional(),
  /** feedback 专属（UI 强制）。 */
  howToApply: z.string().optional(),
  scope: memoryScope,
  /** workspace 作用域时的官方 WorkspaceId。 */
  workspaceId: z.string().optional(),
  /** 新鲜度阈值（天）；默认 30，UI 按类型分档预设（project 7 / reference 90）。 */
  freshnessWarningDays: z.number().int().positive().default(30),
  /** 仅召回统计，不参与新鲜度判断（docs/04-spec §3.6）。 */
  lastAccessedAt: z.string().optional(),
  createdAt: z.string(),
  /** 新鲜度基准 = updatedAt（v0.8.1 修正，不能用 lastAccessedAt）。 */
  updatedAt: z.string(),
})

/** 一条记忆记录（`z.infer`）。 */
export type MemoryRecord = z.infer<typeof memoryRecord>

/** bc-krm 域全局单例：记忆功能总开关。关闭后全局与工作区记忆一律不注入。 */
export const krmGlobalState = z.object({
  memoriesEnabled: z.boolean(),
})

/** 全局单例推断类型。 */
export type KrmGlobalState = z.infer<typeof krmGlobalState>

/**
 * bc-krm 域声明：rules / memories 两表 + 记忆总开关全局单例，版本 1。
 * `defineDomain` 在模块加载期校验域/表名（`UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/`，
 * 无连字符）与版本非负，故域名为 `bc_krm`（下划线）。
 *
 * 全局单例向前兼容：旧文件 `global: null` 视为从未写入，直接 serve `initial`
 * （默认开启记忆）——加总开关不需要 bump 版本；表记录缺 `enabled` 也由 zod
 * `.default(true)` 在持久边界补齐。
 */
export const krmDomainSpec = defineDomain({
  name: 'bc_krm',
  version: 1,
  global: {
    schema: krmGlobalState,
    initial: { memoriesEnabled: true },
  },
  tables: {
    rules: domainTable<string, RuleRecord>(ruleRecord),
    memories: domainTable<string, MemoryRecord>(memoryRecord),
  },
})

// ---------------------------------------------------------------------------
// 注入文本渲染
// ---------------------------------------------------------------------------

/** 记忆索引段上限（docs/04-spec §6.2：记忆索引 25KB / ≤200 行）。 */
export const MEMORY_INDEX_BUDGET = 25 * 1024
/** 记忆索引最大行数（docs/04-spec §3.6，继承 v0.8.1 ≤200 行）。 */
export const MEMORY_INDEX_MAX_LINES = 200

/** 新鲜度警告模板（继承 v0.8.1 §6.4.2，压缩为索引行内一段）。 */
function freshnessWarning(staleDays: number): string {
  return `⚠️ 此记忆已 ${staleDays} 天未更新。记忆是某个时间点的观察记录，并非实时状态——` +
    '其中关于代码行为、数据状态、截止日期的描述可能已过时；在依据此记忆做出判断前，请先验证当前实际状态。'
}

/**
 * 一条记忆的超期天数：`now - updatedAt` 超过 `freshnessWarningDays` 才返回
 * 天数，否则 undefined（未超期）。以 `updatedAt` 为基准（高频召回的旧记忆
 * 依然会过期，v0.8.1 修正）。
 * @param memory - 记忆记录。
 * @param now - 当前时刻。
 * @returns 超期天数，或 undefined。
 */
function memoryStaleDays(memory: MemoryRecord, now: Date): number | undefined {
  const updated = Date.parse(memory.updatedAt)
  if (Number.isNaN(updated)) return undefined
  const days = Math.floor((now.getTime() - updated) / 86_400_000)
  return days > memory.freshnessWarningDays ? days : undefined
}

/** 渲染一条记忆的索引行（超期条目附警告，不阻止使用）。 */
function renderMemoryRow(memory: MemoryRecord, now: Date): string {
  let line = `- **${memory.name}** (${memory.memoryType}) — ${memory.description}`
  const stale = memoryStaleDays(memory, now)
  if (stale !== undefined) line += `\n  ${freshnessWarning(stale)}`
  return line
}

/**
 * 渲染记忆索引段（docs/04-spec §6 格式：名称+类型+描述，超期附警告）。
 * 截断到 ≤200 行 / 25KB。
 * @param rows - 已按作用域过滤的记忆。
 * @param now - 当前时刻（新鲜度判定基准）。
 * @returns 索引段文本，空表时返回 ''（空 context 不贡献任何内容）。
 */
function renderMemoryIndex(rows: readonly MemoryRecord[], now: Date): string {
  if (rows.length === 0) return ''
  const lines: string[] = []
  let size = 0
  for (const row of rows) {
    const rendered = renderMemoryRow(row, now)
    if (lines.length >= MEMORY_INDEX_MAX_LINES) break
    size += rendered.length + 1
    if (size > MEMORY_INDEX_BUDGET) break
    lines.push(rendered)
  }
  return `# 记忆索引\n\n${lines.join('\n')}`
}

/** 渲染行为规则段（docs/04-spec §3.5：启用的全局规则拼接注入）。 */
function renderRulesSection(rows: readonly RuleRecord[]): string {
  if (rows.length === 0) return ''
  return `## 行为规则\n\n${rows.map(rule => `- **${rule.name}**：${rule.content}`).join('\n')}`
}

// ---------------------------------------------------------------------------
// KrmService：持有打开的域 + CRUD + 注入文本提供者
// ---------------------------------------------------------------------------

/** KrmService 需要的宿主服务（结构性；由插件 ctx 提供）。 */
export interface KrmHostServices {
  workspaceRegistry: WorkspaceRegistry
}

/** `/ext` 端点结果信封（沿用 skill-core 的 badRequest 约定）。 */
type KrmResult =
  | { ok: true; value: unknown }
  | { ok: false; error: unknown }

/**
 * 规则 + 记忆 存储服务：打开 `bc-krm` 域，向 `/ext` CRUD 与 system-prompt
 * 注入提供者暴露同一份内存态。写路径统一 `bump()` 递增写入版本并清 memo，
 * 保证注入段随数据变更即时重算。
 */
export class KrmService {
  private rules: KvTable<string, RuleRecord> | undefined
  private memories: KvTable<string, MemoryRecord> | undefined
  private global: DomainGlobal<KrmGlobalState> | undefined
  /** 数据写入版本：任何规则/记忆/总开关写操作 +1，作为注入 memo 的失效键。 */
  private writeVersion = 0
  private rulesMemoKey = ''
  private rulesMemo = ''
  private memoryMemoKey = ''
  private memoryMemo = ''

  /**
   * @param ctx - 插件上下文（声明 storageDomain 注入）。
   * @param host - 反查工作区用的宿主服务。
   */
  constructor(private readonly ctx: Context, private readonly host: KrmHostServices) {}

  /**
   * 打开 bc-krm 域并把 close 挂到插件 fiber。失败即抛（fail loud——存储读
   * 失败时插件加载失败，不静默降级为无注入，docs/04-spec §6.5）。
   */
  async init(): Promise<void> {
    const domain = await this.ctx.storageDomain.open(krmDomainSpec)
    this.rules = domain.table('rules')
    this.memories = domain.table('memories')
    this.global = domain.global
    this.ctx.effect(() => () => { void domain.close() }, 'bc-capability-core: krm domain close')
  }

  /** 规则表（域打开后必可用）。 */
  private requireRules(): KvTable<string, RuleRecord> {
    if (this.rules === undefined) throw new Error('bc-krm domain not opened')
    return this.rules
  }

  /** 记忆表（域打开后必可用）。 */
  private requireMemories(): KvTable<string, MemoryRecord> {
    if (this.memories === undefined) throw new Error('bc-krm domain not opened')
    return this.memories
  }

  /** 全局单例（域打开后必可用）。 */
  private requireGlobal(): DomainGlobal<KrmGlobalState> {
    if (this.global === undefined) throw new Error('bc-krm domain not opened')
    return this.global
  }

  // ---- 记忆总开关（/ext krm.memories.state / krm.memories.setState）----

  /** 记忆功能总开关当前值（关闭后全局 + 工作区记忆一律不注入）。 */
  memoriesState(): KrmResult {
    return { ok: true, value: { ok: true, enabled: this.isMemoriesEnabled() } }
  }

  /** 记忆功能总开关当前值（供注入与工具门控复用）。 */
  isMemoriesEnabled(): boolean {
    return this.requireGlobal().get().memoriesEnabled
  }

  /** 记忆总开关变更监听器（供 AI 写记忆工具的动态注册/注销）。 */
  private readonly memorySwitchListeners = new Set<() => void>()

  /**
   * 订阅记忆总开关变更（关闭/开启时回调，用于动态同步 AI 写记忆工具的可见性）。
   * @param listener - 变更回调。
   * @returns 注销函数。
   */
  onMemoriesEnabledChange(listener: () => void): () => void {
    this.memorySwitchListeners.add(listener)
    return () => { this.memorySwitchListeners.delete(listener) }
  }

  /** 写记忆总开关（持久化 + 清注入 memo + 通知监听器）。 */
  async setMemoriesState(payload: unknown): Promise<KrmResult> {
    const enabled = (payload as { enabled?: unknown }).enabled
    if (typeof enabled !== 'boolean') return badRequest('krm.memories.setState requires enabled (boolean)')
    await this.requireGlobal().set({ memoriesEnabled: enabled })
    this.bump()
    for (const listener of this.memorySwitchListeners) listener()
    return { ok: true, value: { ok: true, enabled } }
  }

  /** 数据已变更：递增写入版本并清注入 memo。 */
  private bump(): void {
    this.writeVersion += 1
    this.rulesMemoKey = ''
    this.memoryMemoKey = ''
  }

  // ---- 规则 CRUD（/ext krm.rules.*）----

  /** 全部规则（创建序）。 */
  listRules(): KrmResult {
    const rows = [...this.requireRules().entries()]
      .map(([, rule]) => rule)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return { ok: true, value: { ok: true, rules: rows } }
  }

  /** 新建规则（名称 + 内容必填；内容自由文本，保持用户原文）。 */
  async createRule(payload: unknown): Promise<KrmResult> {
    const p = payload as Partial<RuleRecord>
    if (typeof p.name !== 'string' || p.name.trim() === '') return badRequest('krm.rules.create requires name')
    if (typeof p.content !== 'string' || p.content.trim() === '') return badRequest('krm.rules.create requires content')
    const now = new Date().toISOString()
    const rule: RuleRecord = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: p.name.trim(),
      content: p.content,
      enabled: p.enabled !== false,
      createdAt: now,
      updatedAt: now,
    }
    await this.requireRules().put(rule.id, rule)
    this.bump()
    return { ok: true, value: { ok: true, rule } }
  }

  /** 更新规则（名称/内容/启用开关；缺省字段保留现值）。 */
  async updateRule(payload: unknown): Promise<KrmResult> {
    const p = payload as Partial<RuleRecord> & { id?: string }
    if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('krm.rules.update requires id')
    const rules = this.requireRules()
    const prev = rules.get(p.id)
    if (prev === undefined) return badRequest('krm.rules.update unknown rule id')
    const name = typeof p.name === 'string' ? p.name.trim() : prev.name
    if (name === '') return badRequest('krm.rules.update requires name')
    const content = typeof p.content === 'string' ? p.content : prev.content
    if (content.trim() === '') return badRequest('krm.rules.update requires content')
    const updated: RuleRecord = {
      ...prev,
      name,
      content,
      enabled: typeof p.enabled === 'boolean' ? p.enabled : prev.enabled,
      updatedAt: new Date().toISOString(),
    }
    await rules.put(updated.id, updated)
    this.bump()
    return { ok: true, value: { ok: true, rule: updated } }
  }

  /** 删除规则。 */
  async deleteRule(payload: unknown): Promise<KrmResult> {
    const p = payload as { id?: string }
    if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('krm.rules.delete requires id')
    const existed = await this.requireRules().delete(p.id)
    if (!existed) return badRequest('krm.rules.delete unknown rule id')
    this.bump()
    return { ok: true, value: { ok: true } }
  }

  // ---- 记忆 CRUD（/ext krm.memories.*）----

  /** 全部记忆（更新时间倒序）。每条附宿主解析的工作区标题（前端下拉展示）。 */
  listMemories(): KrmResult {
    const rows = [...this.requireMemories().entries()]
      .map(([, memory]) => memory)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map(memory => ({ ...memory, workspaceTitle: memory.workspaceId ? this.host.workspaceRegistry.get(memory.workspaceId as WorkspaceId)?.title : undefined }))
    return { ok: true, value: { ok: true, memories: rows } }
  }

  /** 工作区级记忆的必填校验（作用域为 workspace 时必须有合法 workspaceId）。 */
  private requireWorkspace(p: Partial<MemoryRecord>): string | undefined {
    const scope = p.scope === 'workspace' ? 'workspace' : 'global'
    if (scope !== 'workspace') return undefined
    if (typeof p.workspaceId !== 'string' || p.workspaceId.trim() === '') return 'workspace-scoped memory requires workspaceId'
    if (this.host.workspaceRegistry.get(p.workspaceId as WorkspaceId) === undefined) return 'krm.memories unknown workspaceId'
    return undefined
  }

  /** feedback 类型必须携带 why / howToApply（docs/04-spec §3.6 UI 强制）。 */
  private requireFeedback(p: Partial<MemoryRecord>): string | undefined {
    if (p.memoryType !== 'feedback') return undefined
    if (typeof p.why !== 'string' || p.why.trim() === '') return 'feedback memory requires why'
    if (typeof p.howToApply !== 'string' || p.howToApply.trim() === '') return 'feedback memory requires howToApply'
    return undefined
  }

  /** 新建记忆（名称 + 类型 + 内容必填；feedback 强制 why/howToApply）。 */
  async createMemory(payload: unknown): Promise<KrmResult> {
    const p = payload as Partial<MemoryRecord>
    if (typeof p.name !== 'string' || p.name.trim() === '') return badRequest('krm.memories.create requires name')
    if (typeof p.content !== 'string' || p.content.trim() === '') return badRequest('krm.memories.create requires content')
    if (p.memoryType === undefined || !MEMORY_TYPES.includes(p.memoryType)) return badRequest('krm.memories.create requires memoryType (user|feedback|project|reference)')
    const scopeProblem = this.requireWorkspace(p)
    if (scopeProblem !== undefined) return badRequest(scopeProblem)
    const feedbackProblem = this.requireFeedback(p)
    if (feedbackProblem !== undefined) return badRequest(feedbackProblem)
    const now = new Date().toISOString()
    const memory: MemoryRecord = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: p.name.trim(),
      description: typeof p.description === 'string' ? p.description.trim() : '',
      memoryType: p.memoryType,
      enabled: p.enabled !== false,
      content: p.content,
      why: p.why,
      howToApply: p.howToApply,
      scope: p.scope === 'workspace' ? 'workspace' : 'global',
      workspaceId: p.scope === 'workspace' ? p.workspaceId : undefined,
      freshnessWarningDays: typeof p.freshnessWarningDays === 'number' && p.freshnessWarningDays >= 1
        ? Math.floor(p.freshnessWarningDays)
        : 30,
      createdAt: now,
      updatedAt: now,
    }
    await this.requireMemories().put(memory.id, memory)
    this.bump()
    return { ok: true, value: { ok: true, memory } }
  }

  /** 更新记忆（缺省字段保留现值）。 */
  async updateMemory(payload: unknown): Promise<KrmResult> {
    const p = payload as Partial<MemoryRecord> & { id?: string }
    if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('krm.memories.update requires id')
    const memories = this.requireMemories()
    const prev = memories.get(p.id)
    if (prev === undefined) return badRequest('krm.memories.update unknown memory id')
    const memoryType = p.memoryType === undefined || !MEMORY_TYPES.includes(p.memoryType) ? prev.memoryType : p.memoryType
    const scope = p.scope === 'workspace' ? 'workspace' : (p.scope === 'global' ? 'global' : prev.scope)
    const candidate: MemoryRecord = { ...prev, memoryType, scope }
    const scopeProblem = this.requireWorkspace({ ...candidate, workspaceId: scope === 'workspace' ? p.workspaceId ?? prev.workspaceId : undefined })
    if (scopeProblem !== undefined) return badRequest(scopeProblem)
    const feedbackProblem = this.requireFeedback({
      ...candidate,
      why: typeof p.why === 'string' ? p.why : prev.why,
      howToApply: typeof p.howToApply === 'string' ? p.howToApply : prev.howToApply,
    })
    if (feedbackProblem !== undefined) return badRequest(feedbackProblem)
    const name = typeof p.name === 'string' ? p.name.trim() : prev.name
    if (name === '') return badRequest('krm.memories.update requires name')
    const content = typeof p.content === 'string' ? p.content : prev.content
    if (content.trim() === '') return badRequest('krm.memories.update requires content')
    const updated: MemoryRecord = {
      ...prev,
      name,
      description: typeof p.description === 'string' ? p.description.trim() : prev.description,
      memoryType,
      enabled: typeof p.enabled === 'boolean' ? p.enabled : prev.enabled,
      content,
      why: typeof p.why === 'string' ? p.why : prev.why,
      howToApply: typeof p.howToApply === 'string' ? p.howToApply : prev.howToApply,
      scope,
      workspaceId: scope === 'workspace' ? (p.workspaceId ?? prev.workspaceId) : undefined,
      freshnessWarningDays: typeof p.freshnessWarningDays === 'number' && p.freshnessWarningDays >= 1
        ? Math.floor(p.freshnessWarningDays)
        : prev.freshnessWarningDays,
      updatedAt: new Date().toISOString(),
    }
    await memories.put(updated.id, updated)
    this.bump()
    return { ok: true, value: { ok: true, memory: updated } }
  }

  /** 删除记忆。 */
  async deleteMemory(payload: unknown): Promise<KrmResult> {
    const p = payload as { id?: string }
    if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('krm.memories.delete requires id')
    const existed = await this.requireMemories().delete(p.id)
    if (!existed) return badRequest('krm.memories.delete unknown memory id')
    this.bump()
    return { ok: true, value: { ok: true } }
  }

  // ---- AI 自动沉淀（P5 后置增强，docs/04-spec §3.6：走模型面工具）----

  /**
   * AI 在对话中写记忆（bc_write_memory 工具的 execute 入口）。总开关关闭时
   * 直接拒绝（fail-closed——「只有在记忆开关打开的情况下才生效」）。校验四
   * 类型 + feedback 强制 why/howToApply；标题归一化 + 编辑距离去重（命中已有
   * 记忆则更新而非重复新增）；作用域按类型自动推导（project → 当前会话工作区，
   * 其余 → 全局）；新鲜度阈值按类型分档。
   * @param input - 模型工具参数。
   * @param cwd - 当前会话 cwd（用于推导工作区作用域）。
   * @returns 写结果（含 created 标记 + 面向模型的中文确认文案）。
   * @throws 校验失败或总开关关闭时抛错（工具调用以失败呈现，不静默吞掉）。
   */
  async writeMemory(input: MemoryWriteInput, cwd: string | undefined): Promise<MemoryWriteResult> {
    if (!this.isMemoriesEnabled()) {
      throw new Error('记忆功能已关闭（记忆总开关处于关闭状态），无法写入记忆')
    }
    const name = typeof input?.name === 'string' ? input.name.trim() : ''
    const content = typeof input?.content === 'string' ? input.content.trim() : ''
    if (name === '') throw new Error('bc_write_memory 需要 name（记忆标题）')
    if (content === '') throw new Error('bc_write_memory 需要 content（记忆内容）')
    if (input.memoryType === undefined || !MEMORY_TYPES.includes(input.memoryType)) {
      throw new Error('bc_write_memory 需要 memoryType（user | feedback | project | reference）')
    }
    if (input.memoryType === 'feedback'
      && (typeof input.why !== 'string' || input.why.trim() === ''
        || typeof input.howToApply !== 'string' || input.howToApply.trim() === '')) {
      throw new Error('feedback 类型记忆必须同时提供 why 和 howToApply')
    }
    const description = typeof input.description === 'string' ? input.description.trim() : ''
    // 作用域按类型自动推导：project 类记忆是工作区进展 → 当前会话工作区（无则全局）；其余为跨工作区事实 → 全局。
    const workspaceId = input.memoryType === 'project'
      ? workspaceIdOfCwd(this.host.workspaceRegistry, cwd)
      : undefined
    const scope = workspaceId === undefined ? 'global' : 'workspace'
    const now = new Date().toISOString()

    const memories = this.requireMemories()
    const normalized = normalizeMemoryTitle(name)
    let existing: MemoryRecord | undefined
    let bestDistance = Infinity
    for (const [, memory] of memories.entries()) {
      if (normalizeMemoryTitle(memory.name) === normalized) { existing = memory; break }
      const distance = levenshtein(normalized, normalizeMemoryTitle(memory.name))
      if (distance < bestDistance) { bestDistance = distance; existing = memory }
    }
    // 编辑距离阈值：≤2 视为同一记忆（标题近似变体），命中则更新。
    const target = existing !== undefined && (normalizeMemoryTitle(existing.name) === normalized || bestDistance <= 2)
      ? existing
      : undefined

    if (target !== undefined) {
      const updated: MemoryRecord = {
        ...target,
        name,
        description: description === '' ? target.description : description,
        memoryType: input.memoryType,
        content,
        why: input.memoryType === 'feedback' ? input.why?.trim() : undefined,
        howToApply: input.memoryType === 'feedback' ? input.howToApply?.trim() : undefined,
        scope,
        workspaceId: scope === 'workspace' ? workspaceId : undefined,
        freshnessWarningDays: MEMORY_TYPE_FRESHNESS[input.memoryType],
        updatedAt: now,
      }
      await memories.put(target.id, updated)
      this.bump()
      return {
        id: target.id,
        name,
        created: false,
        scope,
        message: `已更新记忆「${name}」（${scope === 'workspace' ? '工作区' : '全局'}），将在后续会话的索引中生效。`,
      }
    }

    const memory: MemoryRecord = {
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      description,
      memoryType: input.memoryType,
      enabled: true,
      content,
      why: input.memoryType === 'feedback' ? input.why?.trim() : undefined,
      howToApply: input.memoryType === 'feedback' ? input.howToApply?.trim() : undefined,
      scope,
      workspaceId: scope === 'workspace' ? workspaceId : undefined,
      freshnessWarningDays: MEMORY_TYPE_FRESHNESS[input.memoryType],
      createdAt: now,
      updatedAt: now,
    }
    await memories.put(memory.id, memory)
    this.bump()
    return {
      id: memory.id,
      name,
      created: true,
      scope,
      message: `已保存记忆「${name}」（${scope === 'workspace' ? '工作区' : '全局'}），将在后续会话的索引中生效。`,
    }
  }

  // ---- 注入文本提供者（P3a-2）----

  /**
   * 行为规则段文本（memoize：规则段只随写入版本变化，避免每 step 重拼）。
   * 空集返回 ''——section 贡献空文本不产生任何内容。
   */
  rulesSectionText(): string {
    const key = `r${this.writeVersion}`
    if (this.rulesMemoKey === key) return this.rulesMemo
    const rows = [...this.requireRules().entries()]
      .map(([, rule]) => rule)
      .filter(rule => rule.enabled)
    const text = renderRulesSection(rows)
    this.rulesMemo = text
    this.rulesMemoKey = key
    return text
  }

  /**
   * 记忆索引段文本（memoize 键 = 写入版本 + 工作区）：记忆总开关关闭时返回
   * ''（全局 + 工作区记忆一律不注入）；开启时按会话绑定工作区过滤启用的
   * 全局 + 该工作区条目；无工作区时只注入全局条目。
   * @param workspaceId - 当前会话绑定工作区，undefined 时只注入全局。
   */
  memoryIndexText(workspaceId: string | undefined): string {
    const key = `m${this.writeVersion}:${workspaceId ?? ''}`
    if (this.memoryMemoKey === key) return this.memoryMemo
    let text = ''
    if (this.isMemoriesEnabled()) {
      const rows = [...this.requireMemories().entries()]
        .map(([, memory]) => memory)
        .filter(memory => memory.enabled !== false
          && (memory.scope === 'global' || (memory.scope === 'workspace' && memory.workspaceId === workspaceId)))
      text = renderMemoryIndex(rows, new Date())
    }
    this.memoryMemo = text
    this.memoryMemoKey = key
    return text
  }

  /**
   * 注入提供者的入口：由会话 cwd 反查绑定工作区再求值记忆索引（供
   * `registerInjection` 的 context 提供者调用，避免从类外访问私有 host）。
   * @param cwd - 会话 header.cwd。
   */
  memoryIndexForCwd(cwd: string | undefined): string {
    return this.memoryIndexText(workspaceIdOfCwd(this.host.workspaceRegistry, cwd))
  }
}

/**
 * 由会话 cwd 反查绑定工作区 id（V2 验证项的落地）：精确匹配工作区路径优先，
 * 否则取最长前缀命中（会话 cwd 可能是工作区根下子目录）。无匹配返回 undefined。
 * @param registry - 官方工作区注册表。
 * @param cwd - 会话 header.cwd（创建即工作区目录，决策 9）。
 * @returns 工作区 id，或 undefined。
 */
export function workspaceIdOfCwd(registry: WorkspaceRegistry, cwd: string | undefined): string | undefined {
  if (cwd === undefined || cwd.trim() === '') return undefined
  const workspaces = registry.list()
  let best: Workspace | undefined
  for (const workspace of workspaces) {
    if (cwd === workspace.path) return String(workspace.id)
    if (cwd.startsWith(workspace.path) && (best === undefined || workspace.path.length > best.path.length)) {
      best = workspace
    }
  }
  return best === undefined ? undefined : String(best.id)
}

/**
 * 注册两条 system-prompt 接缝（P3a-2）：规则段（section）+ 记忆索引段
 * （context）。text 提供者每 step 求值，读域内存态（同步），并按写入版本
 * memoize。作用域过滤经 `assemble.agent` → cwd → 工作区反查完成。
 * @param ctx - 插件上下文（声明 systemPrompt 注入）。
 * @param krm - 已打开的存储服务。
 * @returns 两条接缝的合并 disposer（随插件 fiber 卸载）。
 */
export function registerInjection(ctx: Context, krm: KrmService): () => void {
  const disposeSection = ctx.systemPrompt.section({
    // 规则段：静态段进 system prompt。order 200 位于工具引导（100-199）之后、
    // 任何后续段之前。
    name: 'bc:rules',
    order: 200,
    text: () => krm.rulesSectionText(),
  })
  const disposeContext = ctx.systemPrompt.context({
    // 记忆索引段：user-role runtime-context 快照，不污染 system 前缀缓存。
    name: 'bc:memories',
    order: 0,
    text: (assemble: AssembleContext) => krm.memoryIndexForCwd(assemble.agent?.session.header.cwd),
  })
  return () => { disposeSection(); disposeContext() }
}
