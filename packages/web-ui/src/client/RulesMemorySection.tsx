/**
 * The bc "规则与记忆" settings section (P3a): a two-tab CRUD page — 规则 /
 * 记忆 — against the host `/ext` krm.* endpoints. Previously two empty-state
 * cards (P2-e); now the section owns the full manual-management flow
 * (docs/04-spec §3.5/§3.6):
 *
 * - 规则 tab: global-only behavior rules — create/edit/delete + enable toggle.
 * - 记忆 tab: four-type memories (user/feedback/project/reference), global or
 *   workspace scoped (workspace dropdown fed by the official workspace store),
 *   freshness threshold per type preset (project 7 / reference 90 / default
 *   30), feedback-type forces Why + How to apply. A "不该记忆的内容" hint
 *   (docs/04-spec §3.6) rides the tab.
 *
 * The section rides the official settings shell's `settings.section` slot; its
 * registration injects the same adapter face the shell frame receives, so all
 * reads go through ../adapters/upstream.ts (iron rule 2).
 */
import { useEffect, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  UpstreamInjectFace, UpstreamMemory, UpstreamMemoryType, UpstreamRule, UpstreamWorkspaceOption,
} from '../adapters/upstream.ts'
import { BcConfirmModal } from './PageScaffold.tsx'
import { MemoryIcon, RulesIcon } from './icons.tsx'

/** Full composed props: the section owner share + the `t` seat + the adapter inject face. */
type RulesMemorySectionProps =
  & PropsRuntime<'settings.section'>
  & PropsLocale<'bc'>
  & InjectFace<UpstreamInjectFace>

/** The memory form's completed input (all fields present; submit slices to the optional wire shape). */
interface MemoryFormInput {
  name: string
  description: string
  memoryType: UpstreamMemoryType
  enabled: boolean
  content: string
  why: string
  howToApply: string
  scope: 'global' | 'workspace'
  workspaceId: string | undefined
  freshnessWarningDays: number
}

/** Per-type freshness presets (days; docs/04-spec §3.6 — project 7 / reference 90 / default 30). */
const FRESHNESS_PRESETS: Record<UpstreamMemoryType, number> = {
  user: 30,
  feedback: 30,
  project: 7,
  reference: 90,
}

/** The four memory types in display order. */
const MEMORY_TYPES: readonly UpstreamMemoryType[] = ['user', 'feedback', 'project', 'reference']

/** The type badge's label key (literal-typed so `t` accepts the union). */
const TYPE_KEY: Record<UpstreamMemoryType, `krm.type.${UpstreamMemoryType}`> = {
  user: 'krm.type.user',
  feedback: 'krm.type.feedback',
  project: 'krm.type.project',
  reference: 'krm.type.reference',
}

/** Days since a memory's updatedAt (freshness judge: stale when > threshold). */
function staleDaysOf(memory: UpstreamMemory, now: Date): number | undefined {
  const updated = Date.parse(memory.updatedAt)
  if (Number.isNaN(updated)) return undefined
  const days = Math.floor((now.getTime() - updated) / 86_400_000)
  return days > memory.freshnessWarningDays ? days : undefined
}

/** The freshness meta text ("30 天" / "已过期 45 天"). */
function freshnessText(memory: UpstreamMemory, t: TranslateNS<'bc'>): string {
  const stale = staleDaysOf(memory, new Date())
  if (stale !== undefined) return t('krm.freshnessStale', { days: String(stale) })
  return t('krm.freshnessDays', { days: String(memory.freshnessWarningDays) })
}

// ---------------------------------------------------------------------------
// 规则表单（新建 / 编辑）
// ---------------------------------------------------------------------------

/** The create/edit rule modal: name + content + enabled switch. */
function RuleModal({ t, editing, busy, error, onClose, onSubmit }: {
  t: TranslateNS<'bc'>
  editing: UpstreamRule | undefined
  busy: boolean
  error: string | undefined
  onClose(): void
  onSubmit(input: { name: string; content: string; enabled: boolean }): void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [content, setContent] = useState(editing?.content ?? '')
  const [enabled, setEnabled] = useState(editing?.enabled ?? true)
  const canSubmit = name.trim() !== '' && content.trim() !== '' && !busy
  return (
    <div className="bc-web-ui-modal" role="dialog" aria-modal="true" data-bc-krm-rule-modal>
      <div className="bc-web-ui-modal-mask" aria-hidden="true" />
      <div className="bc-web-ui-modal-panel">
        <header className="bc-web-ui-modal-head">
          <span className="bc-web-ui-modal-title">{editing !== undefined ? t('krm.editRule') : t('krm.newRule')}</span>
          <button type="button" className="bc-web-ui-modal-close" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        </header>
        <div className="bc-web-ui-modal-body">
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('krm.ruleName')}</label>
            <input type="text" className="bc-web-ui-form-input" value={name} onChange={(e) => { setName(e.target.value) }} disabled={busy} />
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('krm.ruleContent')}</label>
            <textarea className="bc-web-ui-form-textarea" rows={5} value={content} onChange={(e) => { setContent(e.target.value) }} disabled={busy} placeholder={t('krm.ruleContentHint')} />
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('krm.enabled')}</label>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? t('krm.disable') : t('krm.enable')}
              className={enabled ? 'bc-web-ui-toggle bc-web-ui-toggle-on' : 'bc-web-ui-toggle'}
              onClick={() => { setEnabled(prev => !prev) }}
              disabled={busy}
            >
              <span className="bc-web-ui-toggle-knob" />
            </button>
          </div>
          {error !== undefined && <p className="bc-web-ui-form-error" role="alert">{error}</p>}
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onClose}>{t('krm.cancel')}</button>
          <button type="button" className="bc-web-ui-modal-primary" onClick={() => { onSubmit({ name: name.trim(), content, enabled }) }} disabled={!canSubmit}>
            {busy ? t('krm.saving') : t('krm.save')}
          </button>
        </footer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 记忆表单（新建 / 编辑）
// ---------------------------------------------------------------------------

/** The create/edit memory modal: title + type + scope (+workspace) + description + content + freshness + feedback pair. */
function MemoryModal({ t, editing, workspaces, busy, error, onClose, onSubmit }: {
  t: TranslateNS<'bc'>
  editing: UpstreamMemory | undefined
  workspaces: readonly UpstreamWorkspaceOption[]
  busy: boolean
  error: string | undefined
  onClose(): void
  onSubmit(input: MemoryFormInput): void
}) {
  const [name, setName] = useState(editing?.name ?? '')
  const [memoryType, setMemoryType] = useState<UpstreamMemoryType>(editing?.memoryType ?? 'user')
  const [enabled, setEnabled] = useState(editing?.enabled ?? true)
  const [scope, setScope] = useState<'global' | 'workspace'>(editing?.scope ?? 'global')
  const [workspaceId, setWorkspaceId] = useState(editing?.workspaceId ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [content, setContent] = useState(editing?.content ?? '')
  const [why, setWhy] = useState(editing?.why ?? '')
  const [howToApply, setHowToApply] = useState(editing?.howToApply ?? '')
  const [freshnessDays, setFreshnessDays] = useState(
    // 新建时默认跟随初始类型（user → 30）；切换类型由 changeType 按分档刷新。
    editing !== undefined ? String(editing.freshnessWarningDays) : String(FRESHNESS_PRESETS.user),
  )

  // 类型切换时按分档预设刷新新鲜度阈值（用户编辑过则保留）——仅新建流程。
  const changeType = (next: UpstreamMemoryType): void => {
    setMemoryType(next)
    if (editing === undefined) setFreshnessDays(String(FRESHNESS_PRESETS[next]))
  }

  const days = Number(freshnessDays)
  const needsWorkspace = scope === 'workspace'
  const workspaceOk = !needsWorkspace || workspaceId !== ''
  const feedbackOk = memoryType !== 'feedback' || (why.trim() !== '' && howToApply.trim() !== '')
  const canSubmit = name.trim() !== '' && content.trim() !== '' && workspaceOk && feedbackOk
    && Number.isInteger(days) && days >= 1 && !busy

  return (
    <div className="bc-web-ui-modal" role="dialog" aria-modal="true" data-bc-krm-memory-modal>
      <div className="bc-web-ui-modal-mask" aria-hidden="true" />
      <div className="bc-web-ui-modal-panel">
        <header className="bc-web-ui-modal-head">
          <span className="bc-web-ui-modal-title">{editing !== undefined ? t('krm.editMemory') : t('krm.newMemory')}</span>
          <button type="button" className="bc-web-ui-modal-close" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        </header>
        <div className="bc-web-ui-modal-body">
          <div className="bc-web-ui-form-grid">
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('krm.memoryName')}</label>
              <input type="text" className="bc-web-ui-form-input" value={name} onChange={(e) => { setName(e.target.value) }} disabled={busy} />
            </div>
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('krm.memoryType')}</label>
              <select className="bc-web-ui-form-select" value={memoryType} onChange={(e) => { changeType(e.target.value as UpstreamMemoryType) }} disabled={busy}>
                {MEMORY_TYPES.map(type => <option key={type} value={type}>{t(TYPE_KEY[type])}</option>)}
              </select>
            </div>
          </div>
          <div className="bc-web-ui-form-grid">
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('krm.scope')}</label>
              <select className="bc-web-ui-form-select" value={scope} onChange={(e) => { setScope(e.target.value as 'global' | 'workspace') }} disabled={busy}>
                <option value="global">{t('krm.scopeGlobal')}</option>
                <option value="workspace">{t('krm.scopeWorkspace')}</option>
              </select>
            </div>
            {needsWorkspace && (
              <div className="bc-web-ui-form-field">
                <label className="bc-web-ui-form-label">{t('krm.workspace')}</label>
                <select className="bc-web-ui-form-select" value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value) }} disabled={busy}>
                  <option value="">{t('krm.noWorkspace')}</option>
                  {workspaces.map(item => <option key={String(item.id)} value={String(item.id)}>{item.title}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('krm.enabled')}</label>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? t('krm.disable') : t('krm.enable')}
              className={enabled ? 'bc-web-ui-toggle bc-web-ui-toggle-on' : 'bc-web-ui-toggle'}
              onClick={() => { setEnabled(prev => !prev) }}
              disabled={busy}
            >
              <span className="bc-web-ui-toggle-knob" />
            </button>
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('krm.memoryDescription')}</label>
            <input type="text" className="bc-web-ui-form-input" value={description} onChange={(e) => { setDescription(e.target.value) }} disabled={busy} placeholder={t('krm.memoryDescriptionHint')} />
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('krm.memoryContent')}</label>
            <textarea className="bc-web-ui-form-textarea" rows={5} value={content} onChange={(e) => { setContent(e.target.value) }} disabled={busy} placeholder={t('krm.memoryContentHint')} />
          </div>
          {memoryType === 'feedback' && (
            <>
              <div className="bc-web-ui-form-field">
                <label className="bc-web-ui-form-label">{t('krm.feedbackWhy')} <span className="bc-web-ui-form-required">*</span></label>
                <textarea className="bc-web-ui-form-textarea" rows={2} value={why} onChange={(e) => { setWhy(e.target.value) }} disabled={busy} placeholder={t('krm.feedbackWhyHint')} />
              </div>
              <div className="bc-web-ui-form-field">
                <label className="bc-web-ui-form-label">{t('krm.feedbackHowToApply')} <span className="bc-web-ui-form-required">*</span></label>
                <textarea className="bc-web-ui-form-textarea" rows={2} value={howToApply} onChange={(e) => { setHowToApply(e.target.value) }} disabled={busy} placeholder={t('krm.feedbackHowToApplyHint')} />
              </div>
            </>
          )}
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('krm.freshness')}</label>
            <input
              type="number"
              min={1}
              className="bc-web-ui-form-input bc-web-ui-form-input-inline"
              value={freshnessDays}
              onChange={(e) => { setFreshnessDays(e.target.value) }}
              disabled={busy}
            />
            <span className="bc-web-ui-form-hint">{t('krm.freshnessHint')}</span>
          </div>
          {error !== undefined && <p className="bc-web-ui-form-error" role="alert">{error}</p>}
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onClose}>{t('krm.cancel')}</button>
          <button type="button" className="bc-web-ui-modal-primary" onClick={() => {
            onSubmit({
              name: name.trim(),
              description: description.trim(),
              memoryType,
              enabled,
              content,
              why,
              howToApply,
              scope,
              workspaceId: needsWorkspace ? workspaceId : undefined,
              freshnessWarningDays: days,
            })
          }} disabled={!canSubmit}>
            {busy ? t('krm.saving') : t('krm.save')}
          </button>
        </footer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 记忆行
// ---------------------------------------------------------------------------

/** One stored memory row: per-entry switch + title + type/scope badges + description + freshness meta + edit/delete. */
function MemoryRow({ memory, t, busy, onToggle, onEdit, onDelete }: {
  memory: UpstreamMemory
  t: TranslateNS<'bc'>
  busy: boolean
  onToggle(): void
  onEdit(): void
  onDelete(): void
}) {
  const stale = staleDaysOf(memory, new Date())
  const metaParts = [
    t(`krm.type.${memory.memoryType}`),
    memory.scope === 'workspace' ? t('krm.scopeWorkspace') : t('krm.scopeGlobal'),
    freshnessText(memory, t),
  ]
  if (memory.scope === 'workspace' && memory.workspaceTitle !== undefined) metaParts.push(memory.workspaceTitle)
  return (
    <div className="bc-web-ui-cron-row" data-bc-krm-memory-row={memory.id}>
      <button
        type="button"
        role="switch"
        aria-checked={memory.enabled}
        aria-label={memory.enabled ? t('krm.disable') : t('krm.enable')}
        className={memory.enabled ? 'bc-web-ui-toggle bc-web-ui-toggle-on' : 'bc-web-ui-toggle'}
        onClick={onToggle}
        disabled={busy}
        data-bc-krm-memory-toggle={memory.id}
      >
        <span className="bc-web-ui-toggle-knob" />
      </button>
      <div className="bc-web-ui-cron-row-main">
        <div className="bc-web-ui-cron-row-head">
          <span className="bc-web-ui-cron-name">{memory.name}</span>
          {!memory.enabled && <span className="bc-web-ui-skill-badge">{t('krm.disabled')}</span>}
          {memory.scope === 'workspace' && <span className="bc-web-ui-skill-badge">{t('krm.scopeWorkspace')}</span>}
          {memory.memoryType === 'feedback' && <span className="bc-web-ui-skill-badge" data-bc-krm-feedback>feedback</span>}
          {stale !== undefined && <span className="bc-web-ui-skill-badge bc-web-ui-skill-badge-warn">{t('krm.staleBadge', { days: String(stale) })}</span>}
        </div>
        <div className="bc-web-ui-cron-meta">
          <span className="bc-web-ui-cron-schedule">{metaParts.join(' · ')}</span>
        </div>
        {memory.description !== '' && <p className="bc-web-ui-cron-desc">{memory.description}</p>}
      </div>
      <div className="bc-web-ui-row-actions">
        <button type="button" className="bc-web-ui-row-action" onClick={onEdit} disabled={busy}>{t('krm.edit')}</button>
        <button type="button" className="bc-web-ui-row-action bc-web-ui-row-action-danger" onClick={onDelete} disabled={busy}>{t('krm.delete')}</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 规则行
// ---------------------------------------------------------------------------

/** One stored rule row: enable switch + name + content + edit/delete. */
function RuleRow({ rule, t, busy, onToggle, onEdit, onDelete }: {
  rule: UpstreamRule
  t: TranslateNS<'bc'>
  busy: boolean
  onToggle(): void
  onEdit(): void
  onDelete(): void
}) {
  return (
    <div className="bc-web-ui-cron-row" data-bc-krm-rule-row={rule.id}>
      <button
        type="button"
        role="switch"
        aria-checked={rule.enabled}
        aria-label={rule.enabled ? t('krm.disable') : t('krm.enable')}
        className={rule.enabled ? 'bc-web-ui-toggle bc-web-ui-toggle-on' : 'bc-web-ui-toggle'}
        onClick={onToggle}
        disabled={busy}
      >
        <span className="bc-web-ui-toggle-knob" />
      </button>
      <div className="bc-web-ui-cron-row-main">
        <div className="bc-web-ui-cron-row-head">
          <span className="bc-web-ui-cron-name">{rule.name}</span>
          {!rule.enabled && <span className="bc-web-ui-skill-badge">{t('krm.disabled')}</span>}
        </div>
        <p className="bc-web-ui-cron-desc">{rule.content}</p>
      </div>
      <div className="bc-web-ui-row-actions">
        <button type="button" className="bc-web-ui-row-action" onClick={onEdit} disabled={busy}>{t('krm.edit')}</button>
        <button type="button" className="bc-web-ui-row-action bc-web-ui-row-action-danger" onClick={onDelete} disabled={busy}>{t('krm.delete')}</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 区块主体
// ---------------------------------------------------------------------------

/** The two-tab 规则与记忆 section (see module doc). */
export function RulesMemorySection({ t, listRules, createRule, updateRule, deleteRule, listMemories, getMemoriesState, setMemoriesState, createMemory, updateMemory, deleteMemory, listWorkspaces }: RulesMemorySectionProps) {
  const [activeTab, setActiveTab] = useState<'rules' | 'memories'>('rules')
  const [rules, setRules] = useState<UpstreamRule[]>([])
  const [memories, setMemories] = useState<UpstreamMemory[]>([])
  const [workspaces, setWorkspaces] = useState<readonly UpstreamWorkspaceOption[]>([])
  // 记忆总开关：关闭后全局 + 工作区记忆都不注入（默认开启）。
  const [memoriesEnabled, setMemoriesEnabled] = useState(true)
  const [loading, setLoading] = useState(false)
  const [ruleModal, setRuleModal] = useState<{ editing: UpstreamRule | undefined } | undefined>(undefined)
  const [memoryModal, setMemoryModal] = useState<{ editing: UpstreamMemory | undefined } | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<{ kind: 'rule' | 'memory'; id: string; name: string } | undefined>(undefined)
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  // 模态提交中（与行操作 busyId 区分）：禁用表单防重复提交 + 显示「保存中…」。
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const [formError, setFormError] = useState<string | undefined>(undefined)

  // 首次挂载 + 工作区切换时刷新数据；记忆表单的工作区下拉与记忆总开关也在此拉取。
  useEffect(() => {
    let current = true
    setLoading(true)
    Promise.all([listRules(), listMemories(), listWorkspaces(), getMemoriesState()]).then(
      ([ruleRows, memoryRows, workspaceRows, master]) => {
        if (!current) return
        setRules(ruleRows)
        setMemories(memoryRows)
        setWorkspaces(workspaceRows)
        setMemoriesEnabled(master)
      },
      () => {},
    ).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [listRules, listMemories, listWorkspaces, getMemoriesState])

  const flash = (message: string): void => {
    setNotice(message)
    window.setTimeout(() => { setNotice(undefined) }, 3000)
  }

  // 规则操作
  const toggleRule = (rule: UpstreamRule): void => {
    setBusyId(rule.id)
    void updateRule({ id: rule.id, enabled: !rule.enabled })
      .then((updated) => { setRules(prev => prev.map(row => row.id === updated.id ? updated : row)) })
      .catch(() => { flash(t('krm.toggleFailed')) })
      .finally(() => { setBusyId(undefined) })
  }

  // 记忆总开关：关闭后所有记忆（全局 + 工作区）不再注入会话。失败回滚 UI。
  const toggleMemoriesMaster = (): void => {
    const next = !memoriesEnabled
    setMemoriesEnabled(next)
    void setMemoriesState(next).catch(() => {
      setMemoriesEnabled(!next)
      flash(t('krm.toggleFailed'))
    })
  }

  // 单条记忆开关。
  const toggleMemory = (memory: UpstreamMemory): void => {
    setBusyId(memory.id)
    void updateMemory({ id: memory.id, enabled: !memory.enabled })
      .then((updated) => { setMemories(prev => prev.map(row => row.id === updated.id ? updated : row)) })
      .catch(() => { flash(t('krm.toggleFailed')) })
      .finally(() => { setBusyId(undefined) })
  }

  const submitRule = (input: { name: string; content: string; enabled: boolean }): void => {
    if (submitting) return
    setSubmitting(true)
    setFormError(undefined)
    const action = ruleModal !== undefined && ruleModal.editing !== undefined
      ? updateRule({ id: ruleModal.editing.id, ...input })
      : createRule(input)
    void action
      .then((rule) => {
        setRules(prev => prev.some(row => row.id === rule.id) ? prev.map(row => row.id === rule.id ? rule : row) : [...prev, rule])
        setRuleModal(undefined)
      })
      .catch(() => { setFormError(t('krm.saveFailed')) })
      .finally(() => { setSubmitting(false) })
  }

  // 记忆操作：把表单的完整输入切成 wire 的可选形状（workspaceId 仅工作区作用
  // 域携带；feedback 专属字段仅 feedback 类型携带），满足 exactOptionalPropertyTypes。
  const submitMemory = (input: MemoryFormInput): void => {
    if (submitting) return
    setSubmitting(true)
    setFormError(undefined)
    const base = {
      name: input.name,
      description: input.description,
      memoryType: input.memoryType,
      enabled: input.enabled,
      content: input.content,
      scope: input.scope,
      freshnessWarningDays: input.freshnessWarningDays,
    }
    const payload = {
      ...base,
      ...(input.memoryType === 'feedback' ? { why: input.why, howToApply: input.howToApply } : {}),
      ...(input.scope === 'workspace' && input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
    }
    const action = memoryModal !== undefined && memoryModal.editing !== undefined
      ? updateMemory({ id: memoryModal.editing.id, ...payload })
      : createMemory(payload)
    void action
      .then((memory) => {
        setMemories(prev => prev.some(row => row.id === memory.id) ? prev.map(row => row.id === memory.id ? memory : row) : [memory, ...prev])
        setMemoryModal(undefined)
      })
      .catch(() => { setFormError(t('krm.saveFailed')) })
      .finally(() => { setSubmitting(false) })
  }

  const confirmDelete = (): void => {
    if (deleteTarget === undefined) return
    setBusyId(deleteTarget.id)
    const action = deleteTarget.kind === 'rule' ? deleteRule(deleteTarget.id) : deleteMemory(deleteTarget.id)
    void action
      .then(() => {
        if (deleteTarget.kind === 'rule') setRules(prev => prev.filter(row => row.id !== deleteTarget.id))
        else setMemories(prev => prev.filter(row => row.id !== deleteTarget.id))
      })
      .catch(() => { flash(t('krm.deleteFailed')) })
      .finally(() => { setBusyId(undefined); setDeleteTarget(undefined) })
  }

  return (
    <div className="bc-web-ui-settings-krm" data-bc-settings-krm>
      <div className="bc-web-ui-settings-krm-tabs" role="tablist" aria-label={t('settings.rulesMemoryNav')}>
        <button
          type="button"
          role="tab"
          className={activeTab === 'rules' ? 'bc-web-ui-settings-krm-tab bc-web-ui-settings-krm-tab-active' : 'bc-web-ui-settings-krm-tab'}
          aria-selected={activeTab === 'rules'}
          onClick={() => { setActiveTab('rules') }}
        >
          {t('krm.tabRules')}
        </button>
        <button
          type="button"
          role="tab"
          className={activeTab === 'memories' ? 'bc-web-ui-settings-krm-tab bc-web-ui-settings-krm-tab-active' : 'bc-web-ui-settings-krm-tab'}
          aria-selected={activeTab === 'memories'}
          onClick={() => { setActiveTab('memories') }}
        >
          {t('krm.tabMemories')}
        </button>
      </div>

      {activeTab === 'rules' && (
        <div className="bc-web-ui-settings-krm-pane" data-bc-krm-tab="rules">
          <div className="bc-web-ui-settings-krm-toolbar">
            <button type="button" className="bc-web-ui-page-cta" data-bc-new-rule onClick={() => { setFormError(undefined); setRuleModal({ editing: undefined }) }}>
              <RulesIcon size={14} />
              {t('krm.newRule')}
            </button>
          </div>
          {notice !== undefined && <p className="bc-web-ui-notice" role="status">{notice}</p>}
          {loading
            ? <p className="bc-web-ui-page-loading">{t('skills.installedLoading')}</p>
            : rules.length === 0
              ? (
                <div className="bc-web-ui-settings-krm-empty" data-bc-krm-empty="rules">
                  <span className="bc-web-ui-settings-krm-icon" aria-hidden="true"><RulesIcon size={20} /></span>
                  <p className="bc-web-ui-settings-krm-title">{t('krm.rulesEmptyTitle')}</p>
                  <p className="bc-web-ui-settings-krm-hint">{t('krm.rulesEmptyHint')}</p>
                </div>
              )
              : (
                <div className="bc-web-ui-page-list">
                  {rules.map(rule => (
                    <RuleRow
                      key={rule.id}
                      rule={rule}
                      t={t}
                      busy={busyId === rule.id}
                      onToggle={() => { toggleRule(rule) }}
                      onEdit={() => { setFormError(undefined); setRuleModal({ editing: rule }) }}
                      onDelete={() => { setDeleteTarget({ kind: 'rule', id: rule.id, name: rule.name }) }}
                    />
                  ))}
                </div>
              )}
        </div>
      )}

      {activeTab === 'memories' && (
        <div className="bc-web-ui-settings-krm-pane" data-bc-krm-tab="memories">
          <div className="bc-web-ui-settings-krm-toolbar">
            <div className="bc-web-ui-settings-krm-master">
              <span className="bc-web-ui-settings-krm-master-label">{t('krm.memoriesMaster')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={memoriesEnabled}
                aria-label={t('krm.memoriesMaster')}
                className={memoriesEnabled ? 'bc-web-ui-toggle bc-web-ui-toggle-on' : 'bc-web-ui-toggle'}
                onClick={toggleMemoriesMaster}
                disabled={loading}
                data-bc-krm-memory-master
              >
                <span className="bc-web-ui-toggle-knob" />
              </button>
            </div>
            <button type="button" className="bc-web-ui-page-cta" data-bc-new-memory onClick={() => { setFormError(undefined); setMemoryModal({ editing: undefined }) }}>
              <MemoryIcon size={14} />
              {t('krm.newMemory')}
            </button>
          </div>
          <p className="bc-web-ui-settings-krm-hint">{t('krm.dontRememberHint')}</p>
          {!memoriesEnabled && <p className="bc-web-ui-settings-krm-hint" data-bc-krm-master-off>{t('krm.memoriesMasterHint')}</p>}
          {notice !== undefined && <p className="bc-web-ui-notice" role="status">{notice}</p>}
          {loading
            ? <p className="bc-web-ui-page-loading">{t('skills.installedLoading')}</p>
            : memories.length === 0
              ? (
                <div className="bc-web-ui-settings-krm-empty" data-bc-krm-empty="memories">
                  <span className="bc-web-ui-settings-krm-icon" aria-hidden="true"><MemoryIcon size={20} /></span>
                  <p className="bc-web-ui-settings-krm-title">{t('krm.memoriesEmptyTitle')}</p>
                  <p className="bc-web-ui-settings-krm-hint">{t('krm.memoriesEmptyHint')}</p>
                </div>
              )
              : (
                <div className="bc-web-ui-page-list">
                  {memories.map(memory => (
                    <MemoryRow
                      key={memory.id}
                      memory={memory}
                      t={t}
                      busy={busyId === memory.id}
                      onToggle={() => { toggleMemory(memory) }}
                      onEdit={() => { setFormError(undefined); setMemoryModal({ editing: memory }) }}
                      onDelete={() => { setDeleteTarget({ kind: 'memory', id: memory.id, name: memory.name }) }}
                    />
                  ))}
                </div>
              )}
        </div>
      )}

      {ruleModal !== undefined && (
        <RuleModal
          key={`rule-${ruleModal.editing?.id ?? 'new'}`}
          t={t}
          editing={ruleModal.editing}
          busy={submitting}
          error={formError}
          onClose={() => { setRuleModal(undefined) }}
          onSubmit={submitRule}
        />
      )}
      {memoryModal !== undefined && (
        <MemoryModal
          key={`memory-${memoryModal.editing?.id ?? 'new'}`}
          t={t}
          editing={memoryModal.editing}
          workspaces={workspaces}
          busy={submitting}
          error={formError}
          onClose={() => { setMemoryModal(undefined) }}
          onSubmit={submitMemory}
        />
      )}
      {deleteTarget !== undefined && (
        <BcConfirmModal
          title={deleteTarget.kind === 'rule' ? t('krm.deleteRuleTitle') : t('krm.deleteMemoryTitle')}
          message={deleteTarget.kind === 'rule' ? t('krm.deleteRuleConfirm', { name: deleteTarget.name }) : t('krm.deleteMemoryConfirm', { name: deleteTarget.name })}
          confirmLabel={t('krm.delete')}
          cancelLabel={t('krm.cancel')}
          danger
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteTarget(undefined) }}
        />
      )}
    </div>
  )
}
