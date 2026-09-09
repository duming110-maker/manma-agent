/**
 * The cron page (P2-e + P1-5): three tabs — 模板 / 任务 / 执行记录. The
 * templates tab lists the host's built-in preset roster (`cron.templates.list`)
 * as example cards: "使用此模板" opens the create modal with the template's
 * name/description/prompt/schedule pre-filled (editable before submit). The
 * task tab manages the JSON-backed task store (host `cron.tasks.*` through
 * `/ext`): create/edit a task from a frequency picker (never a raw cron
 * input), a model dropdown fed by the host `llm.models` catalog, an
 * enable/disable switch, and per-row run / edit / delete actions. The history
 * tab reads the run-history store (`cron.runs.*`). Actual scheduling
 * (cron-parser + execution) lands in P4; the wire derives a five-field cron
 * expression at submit, and the list renders a human-readable schedule — raw
 * cron is never shown to the user.
 */
import { useEffect, useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  UpstreamCronRun, UpstreamCronTask, UpstreamCronTemplate, UpstreamFace, UpstreamModelOption, UpstreamWorkspaceOptions,
} from '../adapters/upstream.ts'
import { BcConfirmModal, BcPageEmpty, BcPageScaffold, type BcPageTab } from './PageScaffold.tsx'
import { CronIcon } from './icons.tsx'

export interface BcCronPageProps {
  upstream: UpstreamFace
  workspaceOptions: UpstreamWorkspaceOptions
  t: TranslateNS<'bc'>
}

/** The schedule picker's frequency union (demo CreateTaskModal posture). */
type CronFrequency = 'daily' | 'weekly' | 'monthly' | 'interval'

/** The weekday pill keys in display order (Mon..Sun; mapped to cron numbers at build). */
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
type WeekdayKey = (typeof WEEKDAY_KEYS)[number]

/** Half-hour time options 00:00..23:30 (demo's execution-time select). */
const TIME_OPTIONS: readonly string[] = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  return i % 2 === 0 ? `${h}:00` : `${h}:30`
})

/** Two-digit pad (cron minute/hour fields lose leading zeros). */
function pad2(value: string | number): string {
  return String(value).padStart(2, '0')
}

/**
 * Compose the cron expression from the picker state (the demo form never
 * shows a raw expression; this is the single derivation the wire consumes).
 * - daily HH:MM     → "M H * * *"
 * - weekly HH:MM    → "M H * * D1,D2" (cron day-of-week: 0=Sun, 1=Mon, …)
 * - monthly D HH:MM → "M H D * *"
 * - interval N h    → "0 every-N-hours field" (hour = slash N)
 * @returns the five-field cron expression, or undefined when the current
 * frequency's required fields are still unset.
 */
function buildCronExpression(
  frequency: CronFrequency, time: string, weekdays: readonly WeekdayKey[], monthDay: number, intervalHours: number,
): string | undefined {
  const [hh, mm] = time.split(':')
  const hour = Number(hh)
  const minute = Number(mm)
  if (frequency === 'daily') return `${minute} ${hour} * * *`
  if (frequency === 'monthly') return `${minute} ${hour} ${monthDay} * *`
  if (frequency === 'interval') {
    if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 23) return undefined
    return `0 */${intervalHours} * * *`
  }
  if (weekdays.length === 0) return undefined
  // WEEKDAY_KEYS is Mon..Sun; cron's day-of-week is 0=Sun..6=Sat.
  const cronDays = weekdays
    .map(key => WEEKDAY_KEYS.indexOf(key))
    .map(index => (index + 1) % 7)
    .sort((a, b) => a - b)
    .join(',')
  return `${minute} ${hour} * * ${cronDays}`
}

/** The reverse of `buildCronExpression`, for pre-filling the edit form. */
function parseCronExpression(expr: string):
  | { frequency: CronFrequency; time: string; weekdays: WeekdayKey[]; monthDay: number; intervalHours: number }
  | undefined {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return undefined
  const minute = parts[0]!
  const hour = parts[1]!
  const dom = parts[2]!
  const month = parts[3]!
  const dow = parts[4]!
  if (month !== '*') return undefined
  if (dom === '*' && dow === '*') {
    if (hour === '*' || minute === '*') return undefined
    return { frequency: 'daily', time: `${pad2(hour)}:${pad2(minute)}`, weekdays: [], monthDay: 1, intervalHours: 6 }
  }
  if (dow === '*' && /^\d+$/.test(dom)) {
    return { frequency: 'monthly', time: `${pad2(hour)}:${pad2(minute)}`, weekdays: [], monthDay: Number(dom), intervalHours: 6 }
  }
  if (minute === '0' && /^\*\/(\d+)$/.test(hour)) {
    return { frequency: 'interval', time: '09:00', weekdays: [], monthDay: 1, intervalHours: Number(hour.slice(2)) }
  }
  if (dom === '*' && dow !== '*') {
    const weekdays: WeekdayKey[] = []
    for (const raw of dow.split(',')) {
      const n = Number(raw)
      if (Number.isNaN(n)) continue
      // Inverse of buildCronExpression: cron day-of-week 0=Sun..6=Sat maps to
      // WEEKDAY_KEYS (Mon..Sun) as index (n + 6) % 7 (n=0 → 6=Sun, n=1 → 0=Mon).
      const key = WEEKDAY_KEYS[(n + 6) % 7]
      if (key !== undefined) weekdays.push(key)
    }
    return { frequency: 'weekly', time: `${pad2(hour)}:${pad2(minute)}`, weekdays, monthDay: 1, intervalHours: 6 }
  }
  return undefined
}

/** Human-readable schedule for the task list (raw cron is never shown). */
function describeCron(expr: string, t: TranslateNS<'bc'>): string {
  const parsed = parseCronExpression(expr)
  if (parsed === undefined) return t('cron.descCustom')
  switch (parsed.frequency) {
    case 'daily': return t('cron.descDaily', { time: parsed.time })
    case 'monthly': return t('cron.descMonthly', { day: String(parsed.monthDay), time: parsed.time })
    case 'interval': return t('cron.descInterval', { hours: String(parsed.intervalHours) })
    case 'weekly': {
      const days = parsed.weekdays.map(key => t(`cron.weekday.${key}`)).join('、')
      return t('cron.descWeekly', { days, time: parsed.time })
    }
  }
}

/** Local `YYYY-MM-DD HH:mm` for a run timestamp. */
function formatTriggerTime(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

/**
 * Initial form state derived from the edited task, else the used template
 * (its example fields pre-fill the create form), else blank for create.
 */
function initialTaskForm(task: UpstreamCronTask | undefined, template: UpstreamCronTemplate | undefined): {
  name: string
  description: string
  prompt: string
  frequency: CronFrequency
  time: string
  weekdays: WeekdayKey[]
  monthDay: number
  intervalHours: number
  workspaceId: string
  modelProvider: string
  model: string
} {
  const cronExpr = task !== undefined ? task.cronExpression : template?.defaultCronExpr
  const parsed = cronExpr !== undefined ? parseCronExpression(cronExpr) : undefined
  return {
    name: task?.name ?? template?.name ?? '',
    description: task?.description ?? template?.description ?? '',
    prompt: task?.prompt ?? template?.prompt ?? '',
    frequency: parsed?.frequency ?? 'daily',
    time: parsed?.time ?? '09:00',
    weekdays: parsed?.weekdays ?? [],
    monthDay: parsed?.monthDay ?? 1,
    intervalHours: parsed?.intervalHours ?? 6,
    workspaceId: task?.workspaceId ?? '',
    modelProvider: task?.modelProvider ?? '',
    model: task?.model ?? '',
  }
}

/** The create/edit task modal (P1-5): frequency picker + model dropdown, never a raw cron input. */
function TaskModal({ workspaceOptions, upstream, t, editing, template, onClose, onSaved }: {
  workspaceOptions: UpstreamWorkspaceOptions
  upstream: UpstreamFace
  t: TranslateNS<'bc'>
  editing: UpstreamCronTask | undefined
  /** The template whose example fields pre-fill the create form (undefined for plain create/edit). */
  template: UpstreamCronTemplate | undefined
  onClose(): void
  onSaved(task: UpstreamCronTask): void
}) {
  const initial = initialTaskForm(editing, template)
  const [name, setName] = useState(initial.name)
  const [description, setDescription] = useState(initial.description)
  const [prompt, setPrompt] = useState(initial.prompt)
  const [frequency, setFrequency] = useState<CronFrequency>(initial.frequency)
  const [time, setTime] = useState(initial.time)
  const [weekdays, setWeekdays] = useState<WeekdayKey[]>(initial.weekdays)
  const [monthDay, setMonthDay] = useState(initial.monthDay)
  const [intervalHours, setIntervalHours] = useState(initial.intervalHours)
  const [workspaceId, setWorkspaceId] = useState(initial.workspaceId)
  const [modelKey, setModelKey] = useState(
    initial.modelProvider !== '' && initial.model !== '' ? `${initial.modelProvider}/${initial.model}` : '',
  )
  const [models, setModels] = useState<readonly UpstreamModelOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    let current = true
    upstream.listModels().then(
      (options) => { if (current) setModels(options) },
      () => {},
    )
    return () => { current = false }
  }, [upstream])

  const toggleWeekday = (key: WeekdayKey): void => {
    setWeekdays(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key])
  }

  const cronExpression = buildCronExpression(frequency, time, weekdays, monthDay, intervalHours)
  const hasInstruction = name.trim() !== '' && (prompt.trim() !== '' || description.trim() !== '')
  const canSubmit = hasInstruction && cronExpression !== undefined && workspaceId !== '' && !submitting

  const submit = (): void => {
    if (cronExpression === undefined || !canSubmit) return
    setSubmitting(true)
    setError(undefined)
    const [modelProvider, model] = modelKey.split('/')
    const payload = {
      name: name.trim(),
      description: description.trim(),
      prompt: prompt.trim(),
      cronExpression,
      workspaceId,
      ...(modelProvider !== undefined && model !== undefined ? { modelProvider, model } : {}),
    }
    const action = editing !== undefined
      ? upstream.updateCronTask({ id: editing.id, ...payload })
      : upstream.createCronTask(payload)
    void action
      .then((task) => { onSaved(task); onClose() })
      .catch(() => { setError(t(editing !== undefined ? 'cron.toggleFailed' : 'cron.createFailed')) })
      .finally(() => { setSubmitting(false) })
  }

  return (
    <div className="bc-web-ui-modal" role="dialog" aria-modal="true" data-bc-cron-modal>
      {/* Mask click does NOT close (demo posture: form content must not be lost). */}
      <div className="bc-web-ui-modal-mask" aria-hidden="true" />
      <div className="bc-web-ui-modal-panel">
        <header className="bc-web-ui-modal-head">
          <span className="bc-web-ui-modal-title">{editing !== undefined ? t('cron.editTitle') : t('cron.newTask')}</span>
          <button type="button" className="bc-web-ui-modal-close" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        </header>
        <div className="bc-web-ui-modal-body">
          {template !== undefined && (
            <p className="bc-web-ui-notice" role="status" data-bc-cron-template-fill>
              {t('cron.templateFillHint', { name: template.name })}
            </p>
          )}
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('cron.taskName')}</label>
            <input type="text" className="bc-web-ui-form-input" value={name} onChange={(e) => { setName(e.target.value) }} disabled={submitting} />
          </div>
          <div className="bc-web-ui-form-grid">
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('cron.frequency')}</label>
              <select
                className="bc-web-ui-form-select"
                value={frequency}
                onChange={(e) => { setFrequency(e.target.value as CronFrequency) }}
                disabled={submitting}
              >
                <option value="daily">{t('cron.freqDaily')}</option>
                <option value="weekly">{t('cron.freqWeekly')}</option>
                <option value="monthly">{t('cron.freqMonthly')}</option>
                <option value="interval">{t('cron.freqInterval')}</option>
              </select>
            </div>
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('cron.time')}</label>
              <select className="bc-web-ui-form-select" value={time} onChange={(e) => { setTime(e.target.value) }} disabled={submitting}>
                {TIME_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          </div>
          {frequency === 'weekly' && (
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('cron.weekDays')}</label>
              <div className="bc-web-ui-seg-group">
                {WEEKDAY_KEYS.map(key => (
                  <button
                    key={key}
                    type="button"
                    className={weekdays.includes(key) ? 'bc-web-ui-seg bc-web-ui-seg-active' : 'bc-web-ui-seg'}
                    onClick={() => { toggleWeekday(key) }}
                    disabled={submitting}
                    data-bc-cron-weekday={key}
                  >
                    {t(`cron.weekday.${key}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {frequency === 'monthly' && (
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('cron.monthDay')}</label>
              <select
                className="bc-web-ui-form-select"
                value={monthDay}
                onChange={(e) => { setMonthDay(Number(e.target.value)) }}
                disabled={submitting}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{day}</option>)}
              </select>
              <span className="bc-web-ui-form-hint">{t('cron.monthDayHint')}</span>
            </div>
          )}
          {frequency === 'interval' && (
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('cron.intervalHours')}</label>
              <input
                type="number"
                min={1}
                max={23}
                className="bc-web-ui-form-input"
                value={intervalHours}
                onChange={(e) => { setIntervalHours(Number(e.target.value)) }}
                disabled={submitting}
              />
              <span className="bc-web-ui-form-hint">{t('cron.intervalHoursHint')}</span>
            </div>
          )}
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('cron.prompt')}</label>
            <textarea className="bc-web-ui-form-textarea" rows={3} value={prompt} onChange={(e) => { setPrompt(e.target.value) }} disabled={submitting} placeholder={t('cron.promptHint')} />
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('cron.taskDescription')}</label>
            <textarea className="bc-web-ui-form-textarea" rows={2} value={description} onChange={(e) => { setDescription(e.target.value) }} disabled={submitting} />
          </div>
          <div className="bc-web-ui-form-grid">
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('cron.workspace')}</label>
              <select className="bc-web-ui-form-select" value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value) }} disabled={submitting}>
                <option value="">{t('cron.noWorkspace')}</option>
                {workspaceOptions.items.map(item => <option key={String(item.id)} value={String(item.id)}>{item.title}</option>)}
              </select>
            </div>
            <div className="bc-web-ui-form-field">
              <label className="bc-web-ui-form-label">{t('cron.model')}</label>
              <select className="bc-web-ui-form-select" value={modelKey} onChange={(e) => { setModelKey(e.target.value) }} disabled={submitting}>
                <option value="">{t('cron.modelDefault')}</option>
                {models.map(model => <option key={`${model.provider}/${model.model}`} value={`${model.provider}/${model.model}`}>{model.name}</option>)}
              </select>
            </div>
          </div>
          {error !== undefined && <p className="bc-web-ui-form-error" role="alert">{error}</p>}
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onClose}>{t('skills.uploadCancel')}</button>
          <button type="button" className="bc-web-ui-modal-primary" onClick={submit} disabled={!canSubmit}>
            {submitting
              ? (editing !== undefined ? t('cron.saving') : t('cron.creating'))
              : (editing !== undefined ? t('cron.save') : t('cron.create'))}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** One stored task row (enable switch + schedule summary + run/edit/delete). */
function TaskRow({ task, workspaceTitle, t, busy, onToggle, onRun, onEdit, onDelete }: {
  task: UpstreamCronTask
  workspaceTitle: string | undefined
  t: TranslateNS<'bc'>
  busy: boolean
  onToggle(): void
  onRun(): void
  onEdit(): void
  onDelete(): void
}) {
  const metaParts = [describeCron(task.cronExpression, t)]
  if (task.modelProvider !== '' && task.model !== '') metaParts.push(task.model)
  if (workspaceTitle !== undefined) metaParts.push(workspaceTitle)
  if (task.enabled && task.nextRunAt !== undefined) metaParts.push(t('cron.nextRun', { time: formatTriggerTime(task.nextRunAt) }))
  return (
    <div className="bc-web-ui-cron-row" data-bc-cron-row={task.id}>
      <button
        type="button"
        role="switch"
        aria-checked={task.enabled}
        aria-label={task.enabled ? t('cron.disable') : t('cron.enable')}
        className={task.enabled ? 'bc-web-ui-toggle bc-web-ui-toggle-on' : 'bc-web-ui-toggle'}
        onClick={onToggle}
        disabled={busy}
        data-bc-cron-toggle={task.id}
      >
        <span className="bc-web-ui-toggle-knob" />
      </button>
      <div className="bc-web-ui-cron-row-main">
        <div className="bc-web-ui-cron-row-head">
          <span className="bc-web-ui-cron-name">{task.name}</span>
          {!task.enabled && <span className="bc-web-ui-skill-badge">{t('cron.disabled')}</span>}
        </div>
        <div className="bc-web-ui-cron-meta">
          <span className="bc-web-ui-cron-schedule">{metaParts.join(' · ')}</span>
        </div>
        {task.description !== '' && <p className="bc-web-ui-cron-desc">{task.description}</p>}
      </div>
      <div className="bc-web-ui-row-actions">
        <button type="button" className="bc-web-ui-row-action" onClick={onRun} disabled={busy || !task.enabled}>{t('cron.run')}</button>
        <button type="button" className="bc-web-ui-row-action" onClick={onEdit} disabled={busy}>{t('cron.edit')}</button>
        <button type="button" className="bc-web-ui-row-action bc-web-ui-row-action-danger" onClick={onDelete} disabled={busy}>{t('cron.delete')}</button>
      </div>
    </div>
  )
}

export function BcCronPage({ upstream, workspaceOptions, t }: BcCronPageProps) {
  const [activeTab, setActiveTab] = useState('tasks')
  const [tasks, setTasks] = useState<UpstreamCronTask[]>([])
  const [runs, setRuns] = useState<UpstreamCronRun[]>([])
  const [templates, setTemplates] = useState<UpstreamCronTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [runsLoading, setRunsLoading] = useState(false)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [modal, setModal] = useState<{ editing: UpstreamCronTask | undefined; template: UpstreamCronTemplate | undefined } | undefined>(undefined)
  const [deleteTarget, setDeleteTarget] = useState<UpstreamCronTask | undefined>(undefined)
  const [busyId, setBusyId] = useState<string | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)

  useEffect(() => {
    let current = true
    setLoading(true)
    upstream.listCronTasks().then(
      (rows) => { if (current) setTasks(rows) },
      () => {},
    ).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [upstream])

  useEffect(() => {
    let current = true
    setRunsLoading(true)
    upstream.listCronRuns().then(
      (rows) => { if (current) setRuns(rows) },
      () => {},
    ).finally(() => { if (current) setRunsLoading(false) })
    return () => { current = false }
  }, [upstream])

  useEffect(() => {
    let current = true
    setTemplatesLoading(true)
    upstream.listCronTemplates().then(
      (rows) => { if (current) setTemplates(rows) },
      () => {},
    ).finally(() => { if (current) setTemplatesLoading(false) })
    return () => { current = false }
  }, [upstream])

  // Live refresh while the history tab is open: runs transition
  // queued → running → success/failed in the background (P4 execution).
  useEffect(() => {
    if (activeTab !== 'history') return
    const timer = window.setInterval(() => {
      void upstream.listCronRuns().then(
        (rows) => { setRuns(rows) },
        () => {},
      )
    }, 4000)
    return () => { window.clearInterval(timer) }
  }, [activeTab, upstream])

  const workspaceTitle = (task: UpstreamCronTask): string | undefined =>
    workspaceOptions.items.find(item => String(item.id) === task.workspaceId)?.title

  const flash = (message: string): void => {
    setNotice(message)
    window.setTimeout(() => { setNotice(undefined) }, 3000)
  }

  const toggleTask = (task: UpstreamCronTask): void => {
    setBusyId(task.id)
    void upstream.updateCronTask({ id: task.id, enabled: !task.enabled })
      .then((updated) => { setTasks(prev => prev.map(row => row.id === updated.id ? updated : row)) })
      .catch(() => { flash(t('cron.toggleFailed')) })
      .finally(() => { setBusyId(undefined) })
  }

  const runTask = (task: UpstreamCronTask): void => {
    setBusyId(task.id)
    void upstream.runCronTask(task.id)
      .then((run) => { setRuns(prev => [run, ...prev]); flash(t('cron.runTriggered')) })
      .catch(() => { flash(t('cron.runFailed')) })
      .finally(() => { setBusyId(undefined) })
  }

  const confirmDelete = (): void => {
    if (deleteTarget === undefined) return
    setBusyId(deleteTarget.id)
    void upstream.deleteCronTask(deleteTarget.id)
      .then(() => { setTasks(prev => prev.filter(row => row.id !== deleteTarget.id)) })
      .catch(() => { flash(t('cron.deleteFailed')) })
      .finally(() => { setBusyId(undefined); setDeleteTarget(undefined) })
  }

  const tabs: readonly BcPageTab[] = [
    { key: 'templates', label: t('cron.tabTemplates') },
    { key: 'tasks', label: t('cron.tabTasks') },
    { key: 'history', label: t('cron.tabHistory') },
  ]

  return (
    <BcPageScaffold
      pageKey="cron"
      title={t('shell.navCron')}
      subtitle={t('cron.subtitle')}
      tabs={tabs}
      activeTab={activeTab}
      onTabSelect={setActiveTab}
      actions={(
        <button type="button" className="bc-web-ui-page-cta" data-bc-new-cron-task onClick={() => { setModal({ editing: undefined, template: undefined }) }}>
          <CronIcon size={14} />
          {t('cron.newTask')}
        </button>
      )}
    >
      {activeTab === 'templates'
        ? (templatesLoading
            ? <p className="bc-web-ui-page-loading">{t('skills.installedLoading')}</p>
            : templates.length === 0
              ? <BcPageEmpty icon={<CronIcon size={24} />} title={t('cron.templatesEmptyTitle')} hint={t('cron.templatesEmptyHint')} />
              : (
                <>
                  <p className="bc-web-ui-notice" role="status" data-bc-cron-templates-intro>{t('cron.templatesIntro')}</p>
                  <div className="bc-web-ui-page-list">
                    {templates.map(tpl => (
                      <div className="bc-web-ui-skill-row" key={tpl.id} data-bc-cron-template={tpl.id}>
                        <div className="bc-web-ui-skill-row-main">
                          <span className="bc-web-ui-skill-icon" aria-hidden="true"><CronIcon size={16} /></span>
                          <div className="bc-web-ui-skill-row-body">
                            <div className="bc-web-ui-skill-row-head">
                              <span className="bc-web-ui-skill-name">{tpl.name}</span>
                              <span className="bc-web-ui-skill-badge">{describeCron(tpl.defaultCronExpr, t)}</span>
                            </div>
                            <p className="bc-web-ui-skill-desc">{tpl.description}</p>
                          </div>
                        </div>
                        <div className="bc-web-ui-row-actions">
                          <button
                            type="button"
                            className="bc-web-ui-row-action"
                            data-bc-cron-template-use={tpl.id}
                            onClick={() => { setModal({ editing: undefined, template: tpl }) }}
                          >
                            {t('cron.templateUse')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ))
        : activeTab === 'history'
          ? (runsLoading
              ? <p className="bc-web-ui-page-loading">{t('skills.installedLoading')}</p>
              : runs.length === 0
                ? <BcPageEmpty icon={<CronIcon size={24} />} title={t('cron.historyEmptyTitle')} hint={t('cron.historyEmptyHint')} />
                : <div className="bc-web-ui-page-list">
                    {runs.map(run => (
                      <div className="bc-web-ui-cron-row" key={run.id} data-bc-cron-run={run.id}>
                        <div className="bc-web-ui-cron-row-main">
                          <div className="bc-web-ui-cron-row-head">
                            <span className="bc-web-ui-cron-name">{run.taskName}</span>
                            <span className="bc-web-ui-skill-badge" data-bc-run-status={run.status}>{t(`cron.runStatus.${run.status}`)}</span>
                          </div>
                          <div className="bc-web-ui-cron-meta">
                            <span className="bc-web-ui-cron-schedule">
                              {run.kind === 'scheduled' ? t('cron.historyScheduled') : t('cron.historyManual')} · {formatTriggerTime(run.triggeredAt)}
                            </span>
                          </div>
                          {run.error !== undefined && <p className="bc-web-ui-cron-desc">{run.error}</p>}
                        </div>
                      </div>
                    ))}
                  </div>)
          : (loading
              ? <p className="bc-web-ui-page-loading">{t('skills.installedLoading')}</p>
              : tasks.length === 0
                ? <BcPageEmpty icon={<CronIcon size={24} />} title={t('cron.tasksEmptyTitle')} hint={t('cron.tasksEmptyHint')} />
                : (
                  <>
                    {notice !== undefined && <p className="bc-web-ui-notice" role="status">{notice}</p>}
                    <div className="bc-web-ui-page-list">
                      {tasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          workspaceTitle={workspaceTitle(task)}
                          t={t}
                          busy={busyId === task.id}
                          onToggle={() => { toggleTask(task) }}
                          onRun={() => { runTask(task) }}
                          onEdit={() => { setModal({ editing: task, template: undefined }) }}
                          onDelete={() => { setDeleteTarget(task) }}
                        />
                      ))}
                    </div>
                  </>
                ))}
      {modal !== undefined && (
        <TaskModal
          key={modal.editing?.id ?? modal.template?.id ?? 'new'}
          workspaceOptions={workspaceOptions}
          upstream={upstream}
          t={t}
          editing={modal.editing}
          template={modal.template}
          onClose={() => { setModal(undefined) }}
          onSaved={(task) => {
            setTasks(prev => prev.some(row => row.id === task.id)
              ? prev.map(row => row.id === task.id ? task : row)
              : [...prev, task])
          }}
        />
      )}
      {deleteTarget !== undefined && (
        <BcConfirmModal
          title={t('cron.deleteTitle')}
          message={t('cron.deleteConfirm', { name: deleteTarget.name })}
          confirmLabel={t('cron.delete')}
          cancelLabel={t('skills.uploadCancel')}
          danger
          onConfirm={confirmDelete}
          onCancel={() => { setDeleteTarget(undefined) }}
        />
      )}
    </BcPageScaffold>
  )
}
