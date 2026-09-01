/**
 * 技能目录变化 → 浏览器端 '/' 补全缓存失效桥（不改上游的根治实现）。
 *
 * 上游事实（决策留痕 2026-08-31-packaged选目录原生对话框修复 同期调查）：
 * - dsh-skill 的磁盘 watcher 在技能增删时发 Host 事件 `skills/change`；
 * - 但 apiproxy 的浏览器转发白名单（API_REMOTE_FORWARDED_EVENTS）没有它，
 *   浏览器永远收不到；
 * - 客户端 ui-skill 的 '/' 补全 catalog（fetchCatalog 按会话缓存）只在收到
 *   `agent-preset/selected` 时 invalidate。
 * 结果：安装/删除技能后，已打开页面的斜杠菜单不含新技能，须手动刷新页面。
 *
 * 本桥：监听 `skills/change`，防抖后**重放一条真实的** `agent-preset/selected`
 * Host 事件（该事件在转发白名单内，浏览器可达）。官方客户端三个订阅者对该
 * 事件的处理全部幂等或无害：
 * - ui-skill：invalidate → 重拉 catalog（目的所在）；
 * - ui-commands：命令目录 refresh（无害重拉）；
 * - ui-agent-preset：noteAgentPreset（官方注释明说幂等）。
 *
 * 载荷"成对真实"：优先重放本进程监听到的最近一条官方广播 (sessionId, preset)
 * （agent-presets 从会话事件流转发而来，值必真）；无记忆时用任一活跃 agent 的
 * session.id + agentPresets.defaultId()（未切换过 preset 的会话其真实值即默认）。
 * 两者皆缺（无活跃会话）时跳过——没有会话就没有 '/' 菜单可刷。
 *
 * 变更履历：
 * - 2026-08-31 初版：skills/change 防抖后桥接 agent-preset/selected 重放。
 * @module capability-core/skill-refresh
 */

/** 防抖窗口：安装一个技能（市场解包/多文件落盘）会触发一串 skills/change。 */
const DEBOUNCE_MS = 800

/** 重放载荷（真实成对值）。 */
interface RealPresetSelection {
  sessionId: string
  agentPreset: string
}

/** 事件桥需要的 ctx 切面（结构化声明，避免对上游包的硬类型依赖——同 timer 先例）。 */
interface BridgeContext {
  on(name: string, listener: (...args: unknown[]) => void): unknown
  emit(name: string, ...args: unknown[]): unknown
  get(name: string): unknown
  agents: { list(): Array<{ session: { id: string } }> }
  logger?: { debug(message: string): void }
}

/**
 * 接线技能目录刷新桥。随插件 fiber 卸载（返回 disposer）。
 * @param ctx - 宿主插件上下文（结构化切面）。
 * @returns 卸载 disposer。
 */
export function wireSkillCatalogRefresh(ctx: BridgeContext): () => void {
  // 官方链路（agent-presets：会话事件流 → ctx.emit）播报时同步记忆真实值。
  let lastReal: RealPresetSelection | undefined
  const offPreset = ctx.on('agent-preset/selected', (...args: unknown[]) => {
    const [sessionId, agentPreset] = args
    if (typeof sessionId === 'string' && typeof agentPreset === 'string' && agentPreset !== '') {
      lastReal = { sessionId, agentPreset }
    }
  })

  let timer: ReturnType<typeof setTimeout> | undefined
  const offChange = ctx.on('skills/change', () => {
    ctx.logger?.debug('skill catalog refresh bridge: received skills/change')
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      const known = lastReal
      if (known !== undefined) {
        // 有真实记忆：原样重放（值与来源会话成对真实，重放幂等）。
        ctx.logger?.debug(`skills/change → replaying agent-preset/selected (${known.sessionId}, ${known.agentPreset})`)
        ctx.emit('agent-preset/selected', known.sessionId, known.agentPreset)
        return
      }
      // 无记忆：任一活跃 agent 的会话 + 当前默认 preset（未切换过 preset 的
      // 会话其真实值即默认，载荷仍真实）。
      const agent = ctx.agents.list()[0]
      if (agent === undefined) return // 无会话即无 '/' 菜单，无需刷新
      const presets = ctx.get('agentPresets') as { defaultId?: string } | undefined
      const defaultId = presets?.defaultId
      if (typeof defaultId !== 'string' || defaultId === '') return
      ctx.logger?.debug(`skills/change → replaying agent-preset/selected (${agent.session.id}, ${defaultId})`)
      ctx.emit('agent-preset/selected', agent.session.id, defaultId)
    }, DEBOUNCE_MS)
  })

  return () => {
    if (timer !== undefined) clearTimeout(timer)
    if (typeof offPreset === 'function') (offPreset as () => void)()
    if (typeof offChange === 'function') (offChange as () => void)()
  }
}
