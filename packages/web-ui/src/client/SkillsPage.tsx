/**
 * The skills page (P2-e + P1-4 + P4): two tabs — 市场 (the GitHub-backed
 * catalog from the bundled manifest, docs/06-skill-standard §6) and 已安装
 * (the installed skill roots, global + per-project, enumerated through
 * `skills.list`). The installed tab carries a search box and a project filter
 * dropdown, marks each row's scope (global vs project) and, for project
 * skills, the owning project, and offers edit (description) / uninstall
 * actions. Local install (P1-4) picks a skill directory, chooses a global or
 * project target, and copies it into the corresponding root; market install
 * (P4) fetches the entry from GitHub through the same target choice.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  UpstreamFace, UpstreamInstalledSkill, UpstreamMarketSkill, UpstreamWorkspaceOptions,
} from '../adapters/upstream.ts'
import { BcConfirmModal, BcPageEmpty, BcPageScaffold, type BcPageTab } from './PageScaffold.tsx'
import { FolderIcon, SearchIcon, SkillsIcon, UploadIcon } from './icons.tsx'

type BcTranslate = TranslateNS<'bc'>

/** One install location (scope + workspace path + on-disk path). */
interface SkillLocation {
  scope: 'global' | 'project'
  workspacePath: string | undefined
  installedPath: string
}

/** A skill grouped by name across all install roots — one row in the list. */
interface GroupedSkill {
  name: string
  description: string
  whenToUse: string | undefined
  modelInvocable: boolean
  locations: SkillLocation[]
}

/** Group flat installed-skill rows by name into one entry per skill. */
function groupSkills(rows: readonly UpstreamInstalledSkill[]): GroupedSkill[] {
  const map = new Map<string, GroupedSkill>()
  for (const row of rows) {
    const existing = map.get(row.name)
    const loc: SkillLocation = { scope: row.scope, workspacePath: row.workspacePath, installedPath: row.installedPath }
    if (existing !== undefined) {
      existing.locations.push(loc)
    } else {
      map.set(row.name, {
        name: row.name,
        description: row.description,
        whenToUse: row.whenToUse,
        modelInvocable: row.modelInvocable,
        locations: [loc],
      })
    }
  }
  const result = Array.from(map.values())
  result.sort((a, b) => a.name.localeCompare(b.name))
  return result
}

/** One installed skill row (icon + name + badges + scope/project markers + edit/uninstall). */
function SkillRow({ skill, locationLabels, t, busy, onEdit, onUninstall }: {
  skill: GroupedSkill
  locationLabels: string[]
  t: BcTranslate
  busy: boolean
  onEdit(): void
  onUninstall(): void
}) {
  const tip = skill.whenToUse !== undefined ? `${skill.description}\n${skill.whenToUse}` : skill.description
  return (
    <div className="bc-web-ui-skill-row" data-bc-skill-row={skill.name} title={tip}>
      <div className="bc-web-ui-skill-row-main">
        <span className="bc-web-ui-skill-icon" aria-hidden="true">{skill.name.charAt(0)}</span>
        <div className="bc-web-ui-skill-row-body">
          <div className="bc-web-ui-skill-row-head">
            <span className="bc-web-ui-skill-name">{skill.name}</span>
            {skill.modelInvocable || <span className="bc-web-ui-skill-badge">{t('skills.userOnlyBadge')}</span>}
            {locationLabels.map(label => (
              <span key={label} className="bc-web-ui-skill-badge">{label}</span>
            ))}
          </div>
          <p className="bc-web-ui-skill-desc">{skill.description}</p>
        </div>
      </div>
      <div className="bc-web-ui-row-actions">
        <button type="button" className="bc-web-ui-row-action" onClick={onEdit} disabled={busy}>{t('skills.edit')}</button>
        <button type="button" className="bc-web-ui-row-action bc-web-ui-row-action-danger" onClick={onUninstall} disabled={busy}>{t('skills.uninstall')}</button>
      </div>
    </div>
  )
}

/** The local-install modal (P1-4): source dir + global/project target(s) + install.
 * When the target is "project", multiple projects may be selected — the skill is
 * installed into each selected project's root (multi-select install). */
function UploadModal({ workspaceOptions, upstream, t, onClose, onDone }: {
  workspaceOptions: UpstreamWorkspaceOptions
  upstream: UpstreamFace
  t: BcTranslate
  onClose(): void
  onDone(): void
}) {
  const [sourcePath, setSourcePath] = useState<string | undefined>(undefined)
  const [target, setTarget] = useState<'global' | 'project'>('global')
  const [workspaceIds, setWorkspaceIds] = useState<readonly string[]>([])
  const [picking, setPicking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const pick = (): void => {
    setPicking(true)
    void upstream.pickWorkspaceDirectory()
      .then((path) => { if (path !== null) setSourcePath(path) })
      .finally(() => { setPicking(false) })
  }

  const toggleWorkspace = (id: string): void => {
    setWorkspaceIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const install = (): void => {
    if (sourcePath === undefined || (target === 'project' && workspaceIds.length === 0)) return
    const jobs: Promise<unknown>[] = []
    if (target === 'global') {
      jobs.push(upstream.installSkill({ sourcePath, target: 'global' }))
    } else {
      for (const id of workspaceIds) {
        const workspace = workspaceOptions.items.find(item => String(item.id) === id)
        if (workspace !== undefined) jobs.push(upstream.installSkill({ sourcePath, target: 'project', workspacePath: workspace.path }))
      }
    }
    setInstalling(true)
    setError(undefined)
    void Promise.all(jobs)
      .then(() => { onDone(); onClose() })
      .catch(() => { setError(t('skills.uploadFailed')) })
      .finally(() => { setInstalling(false) })
  }

  const zoneClass = sourcePath !== undefined
    ? 'bc-web-ui-upload-drop bc-web-ui-upload-drop-chosen'
    : 'bc-web-ui-upload-drop'

  return (
    <div className="bc-web-ui-modal" role="dialog" aria-modal="true" data-bc-upload-modal>
      {/* Mask click does NOT close (demo posture: form content must not be lost). */}
      <div className="bc-web-ui-modal-mask" aria-hidden="true" />
      <div className="bc-web-ui-modal-panel">
        <header className="bc-web-ui-modal-head">
          <span className="bc-web-ui-modal-title">{t('skills.upload')}</span>
          <button type="button" className="bc-web-ui-modal-close" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        </header>
        <div className="bc-web-ui-modal-body">
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('skills.uploadSourceLabel')}</label>
            <button type="button" className={zoneClass} onClick={pick} disabled={picking || installing} data-bc-upload-source>
              {sourcePath !== undefined
                ? (
                  <>
                    <FolderIcon size={32} />
                    <span className="bc-web-ui-upload-drop-path" title={sourcePath}>{sourcePath}</span>
                    <span className="bc-web-ui-upload-drop-hint">{picking ? t('skills.uploadPicking') : t('skills.uploadRepick')}</span>
                  </>
                )
                : (
                  <>
                    <UploadIcon size={32} />
                    <span>{picking ? t('skills.uploadPicking') : t('skills.uploadPickSource')}</span>
                  </>
                )}
            </button>
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('skills.uploadTargetLabel')}</label>
            <div className="bc-web-ui-seg-group">
              <button
                type="button"
                className={target === 'global' ? 'bc-web-ui-seg bc-web-ui-seg-active' : 'bc-web-ui-seg'}
                onClick={() => { setTarget('global') }}
                disabled={installing}
              >
                {t('skills.uploadTargetGlobal')}
              </button>
              <button
                type="button"
                className={target === 'project' ? 'bc-web-ui-seg bc-web-ui-seg-active' : 'bc-web-ui-seg'}
                onClick={() => { setTarget('project') }}
                disabled={installing}
              >
                {t('skills.uploadTargetProject')}
              </button>
            </div>
            {target === 'project' && (
              <>
                <div className="bc-web-ui-upload-workspaces">
                  {workspaceOptions.items.map(item => {
                    const id = String(item.id)
                    const checked = workspaceIds.includes(id)
                    return (
                      <label key={id} className="bc-web-ui-upload-workspace">
                        <input type="checkbox" checked={checked} onChange={() => { toggleWorkspace(id) }} disabled={installing} />
                        <span>{item.title}</span>
                      </label>
                    )
                  })}
                </div>
                <span className="bc-web-ui-form-hint">{t('skills.uploadProjectMultiHint')}</span>
              </>
            )}
          </div>
          {error !== undefined && <p className="bc-web-ui-form-error" role="alert">{error}</p>}
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onClose}>{t('skills.uploadCancel')}</button>
          <button type="button" className="bc-web-ui-modal-primary" onClick={install} disabled={sourcePath === undefined || installing || (target === 'project' && workspaceIds.length === 0)}>
            {installing ? t('skills.uploadInstalling') : t('skills.uploadInstall')}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** The market-install modal (P4): one entry + global/project target + install. */
function MarketInstallModal({ skill, workspaceOptions, upstream, t, onClose, onDone }: {
  skill: UpstreamMarketSkill
  workspaceOptions: UpstreamWorkspaceOptions
  upstream: UpstreamFace
  t: BcTranslate
  onClose(): void
  onDone(): void
}) {
  const [target, setTarget] = useState<'global' | 'project'>('global')
  const [workspaceIds, setWorkspaceIds] = useState<readonly string[]>([])
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const toggleWorkspace = (id: string): void => {
    setWorkspaceIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const install = (): void => {
    if (target === 'project' && workspaceIds.length === 0) return
    const jobs: Promise<unknown>[] = []
    if (target === 'global') {
      jobs.push(upstream.installMarketSkill({ id: skill.id, target: 'global' }))
    } else {
      for (const id of workspaceIds) {
        const workspace = workspaceOptions.items.find(item => String(item.id) === id)
        if (workspace !== undefined) jobs.push(upstream.installMarketSkill({ id: skill.id, target: 'project', workspacePath: workspace.path }))
      }
    }
    setInstalling(true)
    setError(undefined)
    void Promise.all(jobs)
      .then(() => { onDone(); onClose() })
      .catch((reason: unknown) => {
        setError(t('skills.marketInstallFailed', { message: reason instanceof Error ? reason.message : String(reason) }))
      })
      .finally(() => { setInstalling(false) })
  }

  return (
    <div className="bc-web-ui-modal" role="dialog" aria-modal="true" data-bc-market-install-modal>
      <div className="bc-web-ui-modal-mask" aria-hidden="true" />
      <div className="bc-web-ui-modal-panel">
        <header className="bc-web-ui-modal-head">
          <span className="bc-web-ui-modal-title">{t('skills.marketInstallTitle')} · {skill.name}</span>
          <button type="button" className="bc-web-ui-modal-close" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        </header>
        <div className="bc-web-ui-modal-body">
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('skills.uploadTargetLabel')}</label>
            <div className="bc-web-ui-seg-group">
              <button
                type="button"
                className={target === 'global' ? 'bc-web-ui-seg bc-web-ui-seg-active' : 'bc-web-ui-seg'}
                onClick={() => { setTarget('global') }}
                disabled={installing}
              >
                {t('skills.marketTargetGlobal')}
              </button>
              <button
                type="button"
                className={target === 'project' ? 'bc-web-ui-seg bc-web-ui-seg-active' : 'bc-web-ui-seg'}
                onClick={() => { setTarget('project') }}
                disabled={installing}
              >
                {t('skills.marketTargetProject')}
              </button>
            </div>
            {target === 'project' && (
              <>
                <div className="bc-web-ui-upload-workspaces">
                  {workspaceOptions.items.map(item => {
                    const id = String(item.id)
                    const checked = workspaceIds.includes(id)
                    return (
                      <label key={id} className="bc-web-ui-upload-workspace">
                        <input type="checkbox" checked={checked} onChange={() => { toggleWorkspace(id) }} disabled={installing} />
                        <span>{item.title}</span>
                      </label>
                    )
                  })}
                </div>
                <span className="bc-web-ui-form-hint">{t('skills.uploadProjectMultiHint')}</span>
              </>
            )}
          </div>
          {error !== undefined && <p className="bc-web-ui-form-error" role="alert">{error}</p>}
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onClose}>{t('skills.uploadCancel')}</button>
          <button
            type="button"
            className="bc-web-ui-modal-primary"
            onClick={install}
            disabled={installing || (target === 'project' && workspaceIds.length === 0)}
          >
            {installing ? t('skills.marketInstalling') : t('skills.marketInstall')}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** The edit-skill modal: read-only name + editable description frontmatter field
 * + editable install locations (global checkbox + project multi-select). The
 * save flow copies the skill to newly-added locations (via `skills.copy`),
 * rewrites the description on every target, and uninstalls any original
 * location that is no longer selected. */
function EditSkillModal({ skill, workspaceOptions, upstream, t, onClose, onSaved }: {
  skill: GroupedSkill
  workspaceOptions: UpstreamWorkspaceOptions
  upstream: UpstreamFace
  t: BcTranslate
  onClose(): void
  onSaved(): void
}) {
  const [description, setDescription] = useState(skill.description)
  const [target, setTarget] = useState<'global' | 'project'>(() =>
    skill.locations.some(loc => loc.scope === 'global') ? 'global' : 'project',
  )
  const [workspaceIds, setWorkspaceIds] = useState<readonly string[]>(() => {
    const ids: string[] = []
    for (const loc of skill.locations) {
      if (loc.scope === 'project' && loc.workspacePath !== undefined) {
        const match = workspaceOptions.items.find(item => item.path === loc.workspacePath)
        if (match !== undefined) ids.push(String(match.id))
      }
    }
    return ids
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const canSubmit = target === 'global' || workspaceIds.length > 0

  const toggleWorkspace = (id: string): void => {
    setWorkspaceIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id])
  }

  const save = (): void => {
    if (!canSubmit) return
    type Pos = { scope: 'global' | 'project'; workspacePath?: string }
    const targets: Pos[] = []
    if (target === 'global') targets.push({ scope: 'global' })
    for (const id of workspaceIds) {
      const ws = workspaceOptions.items.find(item => String(item.id) === id)
      if (ws !== undefined) targets.push({ scope: 'project', workspacePath: ws.path })
    }
    const posKey = (scope: 'global' | 'project', workspacePath: string | undefined): string =>
      scope === 'global' ? 'global' : `project:${workspacePath}`
    const targetKeys = new Set(targets.map(t => posKey(t.scope, t.workspacePath)))
    const isOrigin = (t: Pos): boolean =>
      skill.locations.some(loc => posKey(loc.scope, loc.workspacePath) === posKey(t.scope, t.workspacePath))
    // Pick any original location as the copy source.
    const sourceLoc = skill.locations[0]
    if (sourceLoc === undefined) return
    const name = skill.name
    const desc = description.trim()
    setSubmitting(true)
    setError(undefined)
    void (async () => {
      // 1) copy to every newly-selected target (skip ones already present).
      for (const t of targets) {
        if (isOrigin(t)) continue
        await upstream.copySkill({
          name,
          fromScope: sourceLoc.scope,
          ...(sourceLoc.workspacePath !== undefined ? { fromWorkspacePath: sourceLoc.workspacePath } : {}),
          toScope: t.scope,
          ...(t.workspacePath !== undefined ? { toWorkspacePath: t.workspacePath } : {}),
        })
      }
      // 2) apply the description on every target.
      for (const t of targets) {
        await upstream.editSkill({ name, scope: t.scope, ...(t.workspacePath !== undefined ? { workspacePath: t.workspacePath } : {}), description: desc })
      }
      // 3) uninstall any original location no longer selected.
      for (const loc of skill.locations) {
        if (!targetKeys.has(posKey(loc.scope, loc.workspacePath))) {
          await upstream.uninstallSkill({ name, scope: loc.scope, ...(loc.workspacePath !== undefined ? { workspacePath: loc.workspacePath } : {}) })
        }
      }
    })()
      .then(() => { onSaved(); onClose() })
      .catch(() => { setError(t('skills.editFailed')) })
      .finally(() => { setSubmitting(false) })
  }

  return (
    <div className="bc-web-ui-modal" role="dialog" aria-modal="true" data-bc-edit-skill-modal>
      <div className="bc-web-ui-modal-mask" aria-hidden="true" />
      <div className="bc-web-ui-modal-panel">
        <header className="bc-web-ui-modal-head">
          <span className="bc-web-ui-modal-title">{t('skills.editTitle')}</span>
          <button type="button" className="bc-web-ui-modal-close" onClick={onClose} aria-label={t('settings.close')}>✕</button>
        </header>
        <div className="bc-web-ui-modal-body">
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('skills.editNameLabel')}</label>
            <input type="text" className="bc-web-ui-form-input" value={skill.name} disabled />
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('skills.editDescriptionLabel')}</label>
            <textarea className="bc-web-ui-form-textarea" rows={4} value={description} onChange={(e) => { setDescription(e.target.value) }} disabled={submitting} />
          </div>
          <div className="bc-web-ui-form-field">
            <label className="bc-web-ui-form-label">{t('skills.editLocationLabel')}</label>
            <div className="bc-web-ui-seg-group">
              <button
                type="button"
                aria-pressed={target === 'global'}
                className={target === 'global' ? 'bc-web-ui-seg bc-web-ui-seg-active' : 'bc-web-ui-seg'}
                onClick={() => { setTarget('global'); setWorkspaceIds([]) }}
                disabled={submitting}
              >
                {t('skills.uploadTargetGlobal')}
              </button>
              <button
                type="button"
                aria-pressed={target === 'project'}
                className={target === 'project' ? 'bc-web-ui-seg bc-web-ui-seg-active' : 'bc-web-ui-seg'}
                onClick={() => { setTarget('project') }}
                disabled={submitting}
              >
                {t('skills.uploadTargetProject')}
              </button>
            </div>
            {target === 'project' && (
              <>
                <div className="bc-web-ui-upload-workspaces">
                  {workspaceOptions.items.map(item => {
                    const id = String(item.id)
                    const checked = workspaceIds.includes(id)
                    return (
                      <label key={id} className="bc-web-ui-upload-workspace">
                        <input type="checkbox" checked={checked} onChange={() => { toggleWorkspace(id) }} disabled={submitting} />
                        <span>{item.title}</span>
                      </label>
                    )
                  })}
                </div>
                <span className="bc-web-ui-form-hint">{t('skills.uploadProjectMultiHint')}</span>
              </>
            )}
          </div>
          {error !== undefined && <p className="bc-web-ui-form-error" role="alert">{error}</p>}
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onClose}>{t('skills.uploadCancel')}</button>
          <button type="button" className="bc-web-ui-modal-primary" onClick={save} disabled={submitting || !canSubmit}>
            {submitting ? t('skills.editSaving') : t('skills.editSave')}
          </button>
        </footer>
      </div>
    </div>
  )
}

export interface BcSkillsPageProps {
  upstream: UpstreamFace
  workspaceOptions: UpstreamWorkspaceOptions
  t: BcTranslate
}

export function BcSkillsPage({ upstream, workspaceOptions, t }: BcSkillsPageProps) {
  const [activeTab, setActiveTab] = useState('market')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [skills, setSkills] = useState<readonly UpstreamInstalledSkill[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [editTarget, setEditTarget] = useState<GroupedSkill | undefined>(undefined)
  const [uninstallTarget, setUninstallTarget] = useState<GroupedSkill | undefined>(undefined)
  const [busyName, setBusyName] = useState<string | undefined>(undefined)
  // Market state (P4): the bundled catalog + the entry being installed.
  const [market, setMarket] = useState<readonly UpstreamMarketSkill[]>([])
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState(false)
  const [marketInstallTarget, setMarketInstallTarget] = useState<UpstreamMarketSkill | undefined>(undefined)

  useEffect(() => {
    let current = true
    setLoading(true)
    setLoadError(false)
    upstream.listInstalledSkills(workspaceOptions.items.map(item => item.path)).then(
      (rows) => { if (current) setSkills(rows) },
      () => { if (current) setLoadError(true) },
    ).finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [upstream, workspaceOptions.loading, reloadKey])

  // Group flat rows by skill name: one row per unique skill (multiple install
  // locations merged into a single list entry).
  const grouped = useMemo(() => groupSkills(skills), [skills])

  useEffect(() => {
    let current = true
    setMarketLoading(true)
    setMarketError(false)
    upstream.listMarketSkills().then(
      (rows) => { if (current) setMarket(rows) },
      () => { if (current) setMarketError(true) },
    ).finally(() => { if (current) setMarketLoading(false) })
    return () => { current = false }
  }, [upstream, reloadKey])

  // Market entries already present in an install root (matched by id — the
  // manifest pins id == directory name, and our catalog's id == skill name).
  const installedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const skill of grouped) {
      ids.add(skill.name)
      for (const loc of skill.locations) {
        if (loc.installedPath !== undefined) ids.add(loc.installedPath.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '')
      }
    }
    return ids
  }, [grouped])

  const locationLabelsFor = (skill: GroupedSkill): string[] => {
    const labels: string[] = []
    if (skill.locations.some(loc => loc.scope === 'global')) labels.push(t('skills.scopeGlobalBadge'))
    for (const loc of skill.locations) {
      if (loc.scope === 'project' && loc.workspacePath !== undefined) {
        const title = workspaceOptions.items.find(item => item.path === loc.workspacePath)?.title
        if (title !== undefined) labels.push(title)
      }
    }
    return labels
  }

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return grouped.filter(skill => {
      if (projectFilter !== '' && !skill.locations.some(loc => loc.scope === 'project' && loc.workspacePath === projectFilter)) return false
      if (query !== '') {
        const inName = skill.name.toLowerCase().includes(query)
        const inDesc = skill.description.toLowerCase().includes(query)
        if (!inName && !inDesc) return false
      }
      return true
    })
  }, [grouped, searchQuery, projectFilter])

  const confirmUninstall = (): void => {
    if (uninstallTarget === undefined) return
    const target = uninstallTarget
    setBusyName(target.name)
    void Promise.all(target.locations.map(loc =>
      upstream.uninstallSkill({
        name: target.name,
        scope: loc.scope,
        ...(loc.workspacePath !== undefined ? { workspacePath: loc.workspacePath } : {}),
      }),
    ))
      .then(() => { setReloadKey(k => k + 1) })
      .finally(() => { setBusyName(undefined); setUninstallTarget(undefined) })
  }

  const tabs: readonly BcPageTab[] = [
    { key: 'market', label: t('skills.tabMarket') },
    { key: 'installed', label: t('skills.tabInstalled') },
  ]

  const installedBody: ReactNode = (() => {
    if (loading) return <p className="bc-web-ui-page-loading">{t('skills.installedLoading')}</p>
    if (loadError) return <BcPageEmpty icon={<SkillsIcon size={24} />} title={t('skills.installedErrorTitle')} hint={t('skills.installedErrorHint')} />
    if (filtered.length === 0 && grouped.length === 0) {
      return <BcPageEmpty icon={<SkillsIcon size={24} />} title={t('skills.installedEmptyTitle')} hint={t('skills.installedEmptyHint')} />
    }
    if (filtered.length === 0) {
      return <BcPageEmpty icon={<SearchIcon size={24} />} title={t('skills.searchEmptyTitle')} hint={t('skills.searchEmptyHint')} />
    }
    return (
      <div className="bc-web-ui-page-list">
        {filtered.map(skill => (
          <SkillRow
            key={skill.name}
            skill={skill}
            locationLabels={locationLabelsFor(skill)}
            t={t}
            busy={busyName === skill.name}
            onEdit={() => { setEditTarget(skill) }}
            onUninstall={() => { setUninstallTarget(skill) }}
          />
        ))}
      </div>
    )
  })()

  const marketBody: ReactNode = (() => {
    if (marketLoading) return <p className="bc-web-ui-page-loading">{t('skills.marketLoading')}</p>
    if (marketError) return <BcPageEmpty icon={<SkillsIcon size={24} />} title={t('skills.marketErrorTitle')} hint={t('skills.marketErrorHint')} />
    if (market.length === 0) return <BcPageEmpty icon={<SkillsIcon size={24} />} title={t('skills.installedEmptyTitle')} hint={t('skills.marketErrorHint')} />
    return (
      <div className="bc-web-ui-page-list">
        {market.map(skill => {
          const installed = installedIds.has(skill.id)
          return (
            <div className="bc-web-ui-skill-row" key={skill.id} data-bc-market-row={skill.id}>
              <div className="bc-web-ui-skill-row-main">
                <span className="bc-web-ui-skill-icon" aria-hidden="true">{skill.name.charAt(0)}</span>
                <div className="bc-web-ui-skill-row-body">
                  <div className="bc-web-ui-skill-row-head">
                    <span className="bc-web-ui-skill-name">{skill.name}</span>
                    {installed && <span className="bc-web-ui-skill-badge">{t('skills.marketInstalled')}</span>}
                    {skill.tags !== undefined && skill.tags.length > 0 && (
                      <span className="bc-web-ui-skill-badge">{skill.tags.join(' · ')}</span>
                    )}
                  </div>
                  <p className="bc-web-ui-skill-desc">{skill.description}</p>
                  <div className="bc-web-ui-skill-meta">
                    {skill.license !== undefined && (
                      <span className="bc-web-ui-skill-project">{t('skills.marketLicense', { license: skill.license })}</span>
                    )}
                    <span className="bc-web-ui-skill-project">{t('skills.marketSource', { repo: skill.source.repo })}</span>
                  </div>
                </div>
              </div>
              <div className="bc-web-ui-row-actions">
                <button
                  type="button"
                  className="bc-web-ui-row-action"
                  onClick={() => { setMarketInstallTarget(skill) }}
                  disabled={installed}
                >
                  {t('skills.marketInstall')}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    )
  })()

  return (
    <BcPageScaffold
      pageKey="skills"
      title={t('shell.navSkills')}
      subtitle={t('skills.subtitle')}
      tabs={tabs}
      activeTab={activeTab}
      onTabSelect={setActiveTab}
      actions={(
        <button type="button" className="bc-web-ui-page-cta" data-bc-upload-skill onClick={() => { setUploadOpen(true) }}>
          <SkillsIcon size={14} />
          {t('skills.upload')}
        </button>
      )}
    >
      {activeTab === 'market'
        ? marketBody
        : (
          <>
            <div className="bc-web-ui-page-toolbar">
              <div className="bc-web-ui-search">
                <SearchIcon size={14} />
                <input
                  type="text"
                  className="bc-web-ui-search-input"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value) }}
                  placeholder={t('skills.searchPlaceholder')}
                />
                {searchQuery !== '' && (
                  <button type="button" className="bc-web-ui-search-clear" onClick={() => { setSearchQuery('') }} aria-label={t('settings.close')}>✕</button>
                )}
              </div>
              <select
                className="bc-web-ui-filter-select"
                value={projectFilter}
                onChange={(e) => { setProjectFilter(e.target.value) }}
                aria-label={t('skills.filterProjectLabel')}
              >
                <option value="">{t('skills.filterAllProjects')}</option>
                {workspaceOptions.items.map(item => <option key={String(item.id)} value={item.path}>{item.title}</option>)}
              </select>
            </div>
            {installedBody}
          </>
        )}
      {uploadOpen && (
        <UploadModal workspaceOptions={workspaceOptions} upstream={upstream} t={t} onClose={() => { setUploadOpen(false) }} onDone={() => { setActiveTab('installed'); setReloadKey(k => k + 1) }} />
      )}
      {marketInstallTarget !== undefined && (
        <MarketInstallModal
          skill={marketInstallTarget}
          workspaceOptions={workspaceOptions}
          upstream={upstream}
          t={t}
          onClose={() => { setMarketInstallTarget(undefined) }}
          onDone={() => { setReloadKey(k => k + 1) }}
        />
      )}
      {editTarget !== undefined && (
        <EditSkillModal
          skill={editTarget}
          workspaceOptions={workspaceOptions}
          upstream={upstream}
          t={t}
          onClose={() => { setEditTarget(undefined) }}
          onSaved={() => { setReloadKey(k => k + 1) }}
        />
      )}
      {uninstallTarget !== undefined && (
        <BcConfirmModal
          title={t('skills.uninstallTitle')}
          message={t('skills.uninstallConfirm', { name: uninstallTarget.name })}
          confirmLabel={t('skills.uninstall')}
          cancelLabel={t('skills.uploadCancel')}
          danger
          onConfirm={confirmUninstall}
          onCancel={() => { setUninstallTarget(undefined) }}
        />
      )}
    </BcPageScaffold>
  )
}
