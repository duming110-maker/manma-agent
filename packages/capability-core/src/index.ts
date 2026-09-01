/**
 * Host half of @bc-agent/capability-core: owns the single `/ext` business RPC
 * channel (registered through the documented `ctx.connection.rpc.handle`) and
 * dispatches its endpoints. Inherits the official browser-trust fence with
 * zero fence code of ours.
 *
 * Endpoints (all loopback-only):
 * - `ext.probe`            echo (spike feasibility probe)
 * - `skills.install`       copy a local skill directory into a skill root
 *                          (frontmatter-validated per docs/06-skill-standard)
 * - `skills.list`          enumerate the global + project install roots
 * - `skills.uninstall`     remove one installed skill directory
 * - `skills.edit`          rewrite a skill's `description` frontmatter field
 * - `skills.move`          move an installed skill between install roots
 * - `skills.copy`          copy an installed skill to another root (no validation)
 * - `skills.market.list`   read the bundled market manifest (06-skill-standard §6)
 * - `skills.market.install` fetch a manifest entry from GitHub + validate + install
 * - `cron.tasks.create`    append a task to the JSON-backed task store
 * - `cron.tasks.list`      read the task store (with live `nextRunAt`)
 * - `cron.tasks.update`    patch one stored task (edit / enable toggle)
 * - `cron.tasks.delete`    remove one stored task
 * - `cron.tasks.run`       queue a manual run (real execution, not a stub)
 * - `cron.runs.list`       read the run-history store
 * - `scene.editors.list`   enumerate installed editors + the default open method
 * - `scene.default.set`    persist the default "open with" method
 * - `scene.editor.open`    launch one editor on a directory
 * - `krm.rules.list`       list stored behavior rules (bc-krm domain)
 * - `krm.rules.create`     append a behavior rule
 * - `krm.rules.update`     patch one stored rule (edit / enable toggle)
 * - `krm.rules.delete`     remove one stored rule
 * - `krm.memories.list`    list stored memories (global + workspace scoped)
 * - `krm.memories.create`  append a memory (four-type taxonomy)
 * - `krm.memories.update`  patch one stored memory
 * - `krm.memories.delete`  remove one stored memory
 * - `krm.memories.state`   read the memory master switch
 * - `krm.memories.setState` write the memory master switch
 *
 * The cron scheduler starts with the plugin fiber (`ctx.interval`, the
 * cordis timer mixin the dsh base mounts) and executes due tasks through
 * `ctx.agents` + `ctx.workspaceRegistry` (see src/cron.ts for the recipe).
 *
 * P3a krm: the `bc-krm` domain (rules/memories tables, defineDomain mechanism)
 * is opened at apply; the two system-prompt seams (rules section + memory
 * index context, see src/krm.ts) register on the same fiber. Fail loud: a
 * domain open failure rejects apply and fails the plugin load.
 *
 * @module @bc-agent/capability-core
 */

import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace'
import {
  badRequest, installSkill, listSkills, uninstallSkill, editSkill, moveSkill, copySkill,
  readMarketManifest, skillTargetDir,
} from './skill-core.ts'
import { installMarketEntry } from './market.ts'
import {
  createCronTask, listCronTasks, updateCronTask, deleteCronTask, listCronRuns,
  runCronTaskNow, startCronScheduler, createSchedulerState, type CronHostServices,
} from './cron.ts'
import { KrmService, registerInjection } from './krm.ts'
import { createMemoryTool } from './memory-tool.ts'
import { wireSkillCatalogRefresh } from './skill-refresh.ts'
import { listInstalledEditors, openEditor, detectEditors, readDefaultOpen, setDefaultOpen } from './scene-editor.ts'

/** The dedicated business RPC channel (03-architecture D3'); `/api` is reserved. */
const EXT_CHANNEL = '/ext'

/** Wait for the connection service: the channel registry lives on it. The
 * `timer` mixin (cordis plugin) is injected so the cron scheduler may use
 * `ctx.interval` (fiber-bound disposal); `agentDefaultModel` feeds the cron
 * executor's model resolution (task pin or deployment default); `storageDomain`
 * opens the bc-krm domain; `systemPrompt` registers the rules/memory seams;
 * `tools` registers the AI-sedimented memory tool (bc_write_memory). */
export const inject = [
  'connection', 'agents', 'workspaceRegistry', 'timer', 'agentDefaultModel', 'storageDomain', 'systemPrompt', 'tools',
]

/** AI 自动沉淀记忆的模型引导段（docs/04-spec §3.6）：只在记忆总开关开启时贡献
 * 文本（空段不产生任何内容），与工具的动态注册保持一致——开关关闭时模型既
 * 看不到工具也看不到写记忆的引导。 */
const MEMORY_SYSTEM_PROMPT = [
  '## 记忆写入',
  '当用户表达了值得跨会话长期记住的内容时，调用 bc_write_memory 工具写入记忆：',
  '- 用户的持久偏好、身份背景、对 AI 行为的纠正或肯定（user / feedback 类型）',
  '- 工作区的进展、决策、截止日期（project 类型，相对日期转绝对日期）',
  '- 外部系统、文档、配置的位置（reference 类型）',
  '不要记忆：代码可直接推导的、git 历史中的、已写在规则里的、一次性细节、纯事实查询结果。',
].join('\n')

/** The executor's view of the injected services. */
const hostOf = (ctx: Context): CronHostServices => {
  const host: CronHostServices = {
    agents: ctx.agents,
    workspaceRegistry: ctx.workspaceRegistry as WorkspaceRegistry,
    // The default-model service's Context declaration lives in its own package
    // (not a dependency here); spelled out structurally, same as the timer.
    defaultModel: (ctx as unknown as { agentDefaultModel: CronHostServices['defaultModel'] }).agentDefaultModel,
  }
  // The preset roster is opt-in: read lazily through ctx.get (api-proxy's
  // no-side-effect stance) rather than injected, so a rosterless deployment
  // still loads capability-core and the executor falls back to the host
  // composition. Read once at wire-up; mount() re-resolves the default per run.
  const agentPresets = (ctx as unknown as { get(name: string): unknown }).get('agentPresets')
  if (agentPresets !== undefined) {
    host.agentPresets = agentPresets as NonNullable<CronHostServices['agentPresets']>
  }
  return host
}

/** Resolve the target skill root for a market/local install payload. */
function targetDirOf(payload: unknown): { ok: true; targetDir: string } | { ok: false; error: unknown } {
  const p = payload as { target?: string; workspacePath?: string }
  if (p.target !== 'global' && p.target !== 'project') return badRequest('requires target "global" | "project"')
  if (p.target === 'project' && (typeof p.workspacePath !== 'string' || p.workspacePath.trim() === '')) {
    return badRequest('project target requires workspacePath')
  }
  return { ok: true, targetDir: skillTargetDir(p.target, p.workspacePath) }
}

/**
 * Build the `/ext` dispatcher for one plugin context (the executor host
 * services close over `ctx`; the handler itself stays an arrow function, so
 * `this` is never relied on).
 * @param ctx - owning plugin context.
 * @param krm - the opened krm storage service (rules/memories CRUD).
 * @returns the dispatch handler.
 */
function createHandler(ctx: Context, krm: KrmService): ConnectionRpcHandler {
  const host = hostOf(ctx)
  return async (endpoint, payload) => {
    switch (endpoint) {
      case 'ext.probe':
        return { ok: true, value: { ok: true, channel: 'ext', pong: payload } }
      // skills
      case 'skills.install':
        return installSkill(payload) as never
      case 'skills.list':
        return listSkills(payload) as never
      case 'skills.uninstall':
        return uninstallSkill(payload) as never
      case 'skills.edit':
        return editSkill(payload) as never
      case 'skills.move':
        return moveSkill(payload) as never
      case 'skills.copy':
        return copySkill(payload) as never
      // skill market (docs/06-skill-standard §6)
      case 'skills.market.list':
        return { ok: true, value: readMarketManifest() } as never
      case 'skills.market.install': {
        const p = payload as { id?: string; target?: string; workspacePath?: string }
        if (typeof p.id !== 'string' || p.id.trim() === '') return badRequest('skills.market.install requires id') as never
        const target = targetDirOf(payload)
        if (!target.ok) return target as never
        const entry = readMarketManifest().skills.find(item => item.id === p.id)
        if (entry === undefined) return badRequest(`skills.market.install unknown market id "${p.id}"`) as never
        try {
          const result = await installMarketEntry(entry, target.targetDir)
          return { ok: true, value: result } as never
        } catch (error: unknown) {
          return badRequest(error instanceof Error ? error.message : String(error)) as never
        }
      }
      // cron tasks
      case 'cron.tasks.create':
        return createCronTask(payload) as never
      case 'cron.tasks.list':
        return listCronTasks() as never
      case 'cron.tasks.update':
        return updateCronTask(payload) as never
      case 'cron.tasks.delete':
        return deleteCronTask(payload) as never
      case 'cron.tasks.run': {
        const result = runCronTaskNow(host, payload)
        return result as never
      }
      case 'cron.runs.list':
        return listCronRuns() as never
      // scene editor (detect local IDEs + remember the default open method)
      case 'scene.editors.list':
        return { ok: true, value: { editors: listInstalledEditors(), defaultOpen: readDefaultOpen() } } as never
      case 'scene.default.set':
        return setDefaultOpen(payload) as never
      case 'scene.editor.open':
        return openEditor(payload) as never
      // rules + memories (P3a capability-krm)
      case 'krm.rules.list':
        return krm.listRules() as never
      case 'krm.rules.create':
        return krm.createRule(payload) as never
      case 'krm.rules.update':
        return krm.updateRule(payload) as never
      case 'krm.rules.delete':
        return krm.deleteRule(payload) as never
      case 'krm.memories.list':
        return krm.listMemories() as never
      case 'krm.memories.create':
        return krm.createMemory(payload) as never
      case 'krm.memories.update':
        return krm.updateMemory(payload) as never
      case 'krm.memories.delete':
        return krm.deleteMemory(payload) as never
      case 'krm.memories.state':
        return krm.memoriesState() as never
      case 'krm.memories.setState':
        return krm.setMemoriesState(payload) as never
      default:
        return badRequest(`unknown /ext endpoint ${JSON.stringify(endpoint)}`) as never
    }
  }
}

/**
 * Register the `/ext` channel (loopback-only authority, iron rule 6), open the
 * bc-krm domain and register the rules/memory injection seams, then start the
 * cron scheduler with the plugin fiber. Async apply: the domain open is
 * awaited before the channel registers, so a storage failure fails the plugin
 * load loud (docs/04-spec §6.5) instead of surfacing mid-request.
 * @param ctx - owning plugin context.
 */
export async function apply(ctx: Context): Promise<void> {
  // Detect installed editors once at startup; the roster is cached for the
  // process lifetime (re-scanned on next launch).
  detectEditors()

  const krm = new KrmService(ctx, { workspaceRegistry: ctx.workspaceRegistry as WorkspaceRegistry })
  await krm.init()

  ctx.effect(
    () => ctx.connection.rpc.handle(EXT_CHANNEL, createHandler(ctx, krm), { authority: 'loopback' }),
    'bc-capability-core: /ext rpc channel',
  )
  ctx.effect(
    () => registerInjection(ctx, krm),
    'bc-capability-core: rules section + memory index context',
  )
  // AI 自动沉淀记忆工具：按记忆总开关动态注册/注销（开关关闭时模型看不到也
  // 调不到该工具）；监听开关变更即时同步。execute 内另做 fail-closed 复检。
  let disposeMemoryTool: (() => void) | undefined
  const syncMemoryTool = (): void => {
    if (disposeMemoryTool !== undefined) { disposeMemoryTool(); disposeMemoryTool = undefined }
    if (krm.isMemoriesEnabled()) disposeMemoryTool = ctx.tools.register(createMemoryTool(krm))
  }
  krm.onMemoriesEnabledChange(() => { syncMemoryTool() })
  syncMemoryTool()
  ctx.effect(
    () => () => { disposeMemoryTool?.() },
    'bc-capability-core: memory write tool',
  )
  ctx.effect(
    () => ctx.systemPrompt.section({
      // 记忆写入引导段：开关关闭时返回空文本（空段不产生内容），与工具可见性一致。
      name: 'bc:memory-guidance',
      order: 110,
      text: () => krm.isMemoriesEnabled() ? MEMORY_SYSTEM_PROMPT : '',
    }),
    'bc-capability-core: memory guidance section',
  )
  ctx.effect(
    () => startCronScheduler(
      // The timer mixin is declared on Context by the vendored cordis timer
      // plugin (mounted in the dsh base); capability-core avoids a hard type
      // dependency on that package, so the call surface is spelled out here.
      ctx as unknown as { interval(callback: () => void, delay: number): () => void },
      hostOf(ctx),
      createSchedulerState(),
    ),
    'bc-capability-core: cron scheduler',
  )
  // 技能目录变化 → 浏览器端 '/' 补全缓存失效桥（不改上游；机制见模块注释）。
  ctx.effect(
    () => wireSkillCatalogRefresh(ctx as unknown as Parameters<typeof wireSkillCatalogRefresh>[0]),
    'bc-capability-core: skill catalog refresh bridge',
  )
}
