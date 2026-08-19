/**
 * The skills page (P2-e + P1-4): two tabs — 市场 (local install entry now;
 * the community market arrives later) and 已安装 (the installed skill roots,
 * global + per-project, enumerated through `skills.list`). The installed tab
 * carries a search box and a project filter dropdown, marks each row's scope
 * (global vs project) and, for project skills, the owning project, and offers
 * edit (description) / uninstall actions. Local install (P1-4) picks a skill
 * directory, chooses a global or project target, and copies it into the
 * corresponding root.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  UpstreamFace, UpstreamInstalledSkill, UpstreamWorkspaceOptions,
} from '../adapters/upstream.ts'
import { BcConfirmModal, BcPageEmpty, BcPageScaffold, type BcPageTab } from './PageScaffold.tsx'
import { FolderIcon, SearchIcon, SkillsIcon, UploadIcon } from './icons.tsx'

type BcTranslate = TranslateNS<'bc'>

/** One installed skill row (icon + name + badges + scope/project marker + edit/uninstall). */
function SkillRow({ skill, projectTitle, t, busy, onEdit, onUninstall }: {
  skill: UpstreamInstalledSkill
  projectTitle: string | undefined
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
            <span className="bc-web-ui-skill-badge">{skill.scope === 'global' ? t('skills.scopeGlobalBadge') : t('skills.scopeProjectBadge')}</span>
          </div>
          <p className="bc-web-ui-skill-desc">{skill.description}</p>
          <div className="bc-web-ui-skill-meta">
            {skill.scope === 'project' && projectTitle !== undefined && (
              <span className="bc-web-ui-skill-project">{t('skills.usedByProject', { project: projectTitle })}</span>
            )}
          </div>
        </div>
      </div>
      <div className="bc-web-ui-row-actions">
        <button type="button" className="bc-web-ui-row-action" onClick={onEdit} disabled={busy}>{t('skills.edit')}</button>
        <button type="button" className="bc-web-ui-row-action bc-web-ui-row-action-danger" onClick={onUninstall} disabled={busy}>{t('skills.uninstall')}</button>
      </div>
    </div>
  )
}

/** The local-install modal (P1-4): source dir + global/project target + install. */
function UploadModal({ workspaceOptions, upstream, t, onClose, onDone }: {
  workspaceOptions: UpstreamWorkspaceOptions
  upstream: UpstreamFace
  t: BcTranslate
  onClose(): void
  onDone(): void
}) {
  const [sourcePath, setSourcePath] = useState<string | undefined>(undefined)
  const [target, setTarget] = useState<'global' | 'project'>('global')
  const [workspaceId, setWorkspaceId] = useState<string | undefined>(undefined)
  const [picking, setPicking] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const pick = (): void => {
    setPicking(true)
    void upstream.pickWorkspaceDirectory()
      .then((path) => { if (path !== null) setSourcePath(path) })
      .finally(() => { setPicking(false) })
  }

  const install = (): void => {
    if (sourcePath === undefined || (target === 'project' && workspaceId === undefined)) return
    const workspace = workspaceOptions.items.find(item => String(item.id) === workspaceId)
    setInstalling(true)
    setError(undefined)
    void upstream.installSkill({
      sourcePath,
      target,
      ...(target === 'project' && workspace !== undefined ? { workspacePath: workspace.path } : {}),
    })
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
              <select className="bc-web-ui-form-select" value={workspaceId ?? ''} onChange={(e) => { setWorkspaceId(e.target.value) }} disabled={installing}>
                <option value="">{t('skills.uploadNoWorkspace')}</option>
                {workspaceOptions.items.map(item => <option key={String(item.id)} value={String(item.id)}>{item.title}</option>)}
              </select>
            )}
          </div>
          {error !== undefined && <p className="bc-web-ui-form-error" role="alert">{error}</p>}
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onClose}>{t('skills.uploadCancel')}</button>
          <button type="button" className="bc-web-ui-modal-primary" onClick={install} disabled={sourcePath === undefined || installing || (target === 'project' && workspaceId === undefined)}>
            {installing ? t('skills.uploadInstalling') : t('skills.uploadInstall')}
          </button>
        </footer>
      </div>
    </div>
  )
}

/** The edit-skill modal: read-only name + editable description frontmatter field. */
function EditSkillModal({ skill, upstream, t, onClose, onSaved }: {
  skill: UpstreamInstalledSkill
  upstream: UpstreamFace
  t: BcTranslate
  onClose(): void
  onSaved(): void
}) {
  const [description, setDescription] = useState(skill.description)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const save = (): void => {
    setSubmitting(true)
    setError(undefined)
    void upstream.editSkill({
      name: skill.name,
      scope: skill.scope,
      ...(skill.workspacePath !== undefined ? { workspacePath: skill.workspacePath } : {}),
      description: description.trim(),
    })
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
          {error !== undefined && <p className="bc-web-ui-form-error" role="alert">{error}</p>}
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onClose}>{t('skills.uploadCancel')}</button>
          <button type="button" className="bc-web-ui-modal-primary" onClick={save} disabled={submitting}>
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
  const [editTarget, setEditTarget] = useState<UpstreamInstalledSkill | undefined>(undefined)
  const [uninstallTarget, setUninstallTarget] = useState<UpstreamInstalledSkill | undefined>(undefined)
  const [busyName, setBusyName] = useState<string | undefined>(undefined)

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

  const projectTitle = (skill: UpstreamInstalledSkill): string | undefined =>
    skill.workspacePath !== undefined
      ? workspaceOptions.items.find(item => item.path === skill.workspacePath)?.title
      : undefined

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return skills.filter(skill => {
      if (projectFilter !== '' && skill.scope === 'project' && skill.workspacePath !== projectFilter) return false
      if (query !== '') {
        const inName = skill.name.toLowerCase().includes(query)
        const inDesc = skill.description.toLowerCase().includes(query)
        if (!inName && !inDesc) return false
      }
      return true
    })
  }, [skills, searchQuery, projectFilter])

  const confirmUninstall = (): void => {
    if (uninstallTarget === undefined) return
    setBusyName(uninstallTarget.name)
    void upstream.uninstallSkill({
      name: uninstallTarget.name,
      scope: uninstallTarget.scope,
      ...(uninstallTarget.workspacePath !== undefined ? { workspacePath: uninstallTarget.workspacePath } : {}),
    })
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
    if (filtered.length === 0 && skills.length === 0) {
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
            projectTitle={projectTitle(skill)}
            t={t}
            busy={busyName === skill.name}
            onEdit={() => { setEditTarget(skill) }}
            onUninstall={() => { setUninstallTarget(skill) }}
          />
        ))}
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
        ? <BcPageEmpty icon={<SkillsIcon size={24} />} title={t('skills.marketEmptyTitle')} hint={t('skills.marketEmptyHint')} />
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
      {editTarget !== undefined && (
        <EditSkillModal
          skill={editTarget}
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
