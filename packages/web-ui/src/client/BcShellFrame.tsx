/**
 * The shell frame (P1-4 revision): a three-column grid — a self-built sidebar
 * (brand + skills/cron nav + the OFFICIAL workspace/session browser via
 * `sidebar.workspaces` + footer settings) + the official conversation surface
 * + a zero-width details column.
 *
 * Workspace selection / creation / management is delegated to the official
 * ui-workspace browser (`sidebar.workspaces`), not rebuilt — the frame keeps
 * only its own chrome (brand, page nav, settings). The conversation surface
 * (`conversation` seat) is rendered verbatim; when no session is current the
 * official ConversationRoot shows its New-Session hero.
 */
import { useMemo, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { UpstreamFace, UpstreamFeedProps, UpstreamInjectFace } from '../adapters/upstream.ts'
import { projectSessionHeader, projectWorkspaceOptions } from '../adapters/upstream.ts'
import { BRANDING } from './branding.ts'
import { BcCronPage } from './CronPage.tsx'
import { BcSessionHeader } from './SessionHeader.tsx'
import { BcSkillsPage } from './SkillsPage.tsx'
import { CronIcon, NewTaskIcon, SkillsIcon } from './icons.tsx'

/** Full composed props: runtime share + adapter inject face + `t` seat + child-slot render share. */
export type BcShellFrameProps =
  & PropsRuntime<'root'>
  & UpstreamFeedProps
  & InjectFace<UpstreamInjectFace>
  & PropsLocale<'bc'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay' | 'sidebar.settings' | 'sidebar.workspaces'>

/** Main-area view: the official conversation surface or one nav page. */
type BcMainView = 'conversation' | 'skills' | 'cron'

/**
 * The shell frame (see module doc): brand + nav + official workspace browser
 * in the sidebar, official conversation in the center, and the OFFICIAL
 * settings trigger (opens the official settings panel) in the sidebar footer.
 * @param props - composed props.
 * @returns the frame element tree.
 */
export function BcShellFrame({ useSessions, useWorkspaces, useLocale, setLocale, setTheme: setOfficialTheme, newSession, archiveSession, renameSession, listSessionSkills, installSkill, installMarketSkill, listMarketSkills, listCronTasks, createCronTask, updateCronTask, deleteCronTask, runCronTask, listCronRuns, listModels, listInstalledSkills, uninstallSkill, editSkill, listWorkspaces, listRules, createRule, updateRule, deleteRule, listMemories, getMemoriesState, setMemoriesState, createMemory, updateMemory, deleteMemory, pickWorkspaceDirectory, t, renderSlot }: BcShellFrameProps) {
  const [view, setView] = useState<BcMainView>('conversation')
  const workspaces = useWorkspaces(state => state)
  const sessions = useSessions(state => state)
  const locale = useLocale(state => state)
  const sessionHeader = projectSessionHeader(workspaces, sessions)
  const workspaceOptions = projectWorkspaceOptions(workspaces)

  // The adapter face, identity-stable across renders: children's fetch effects
  // key on this object, so a per-render rebuild would re-run them every frame.
  const upstream = useMemo<UpstreamFace>(() => ({
    newSession, archiveSession, renameSession, listSessionSkills, setLocale, setTheme: setOfficialTheme, pickWorkspaceDirectory, installSkill, installMarketSkill, listMarketSkills, listCronTasks, createCronTask, updateCronTask, deleteCronTask, runCronTask, listCronRuns, listModels, listInstalledSkills, uninstallSkill, editSkill, listWorkspaces, listRules, createRule, updateRule, deleteRule, listMemories, getMemoriesState, setMemoriesState, createMemory, updateMemory, deleteMemory,
  }), [newSession, archiveSession, renameSession, listSessionSkills, setLocale, setOfficialTheme, pickWorkspaceDirectory, installSkill, installMarketSkill, listMarketSkills, listCronTasks, createCronTask, updateCronTask, deleteCronTask, runCronTask, listCronRuns, listModels, listInstalledSkills, uninstallSkill, editSkill, listWorkspaces, listRules, createRule, updateRule, deleteRule, listMemories, getMemoriesState, setMemoriesState, createMemory, updateMemory, deleteMemory])

  const brandName = locale.active === 'en' ? BRANDING.product.name.en : BRANDING.product.name.zh
  // The brand mark's glyph: the product name's first character (derived from
  // the branding single source — the mark is decorative, the name follows it).
  const brandMarkGlyph = brandName.charAt(0)

  return (
    <div className="bc-web-ui-frame">
      <aside className="bc-web-ui-sidebar" data-bc-sidebar aria-label={t('shell.sidebarLabel')}>
        {/* Brand header: branding-sourced name + primary-colored mark. */}
        <div className="bc-web-ui-sidebar-header" data-bc-brand-area>
          <span className="bc-web-ui-brand-mark" data-bc-brand aria-hidden="true">{brandMarkGlyph}</span>
          <span className="bc-web-ui-brand-name" data-bc-brand-name>{brandName}</span>
        </div>

        <nav className="bc-web-ui-nav-block">
          <button
            type="button"
            className={view === 'conversation'
              ? 'bc-web-ui-nav-item bc-web-ui-nav-item-active'
              : 'bc-web-ui-nav-item'}
            data-bc-nav-new-task
            data-bc-nav-new-task-active={view === 'conversation' ? 'true' : undefined}
            onClick={() => { newSession(); setView('conversation') }}
          >
            <span className="bc-web-ui-nav-icon"><NewTaskIcon size={18} /></span>
            <span className="bc-web-ui-nav-label">{t('shell.newTask')}</span>
          </button>
          <button
            type="button"
            className={view === 'skills'
              ? 'bc-web-ui-nav-item bc-web-ui-nav-item-active'
              : 'bc-web-ui-nav-item'}
            data-bc-nav-skills
            aria-current={view === 'skills' ? 'page' : undefined}
            onClick={() => { setView('skills') }}
          >
            <span className="bc-web-ui-nav-icon"><SkillsIcon size={18} /></span>
            <span className="bc-web-ui-nav-label">{t('shell.navSkills')}</span>
          </button>
          <button
            type="button"
            className={view === 'cron'
              ? 'bc-web-ui-nav-item bc-web-ui-nav-item-active'
              : 'bc-web-ui-nav-item'}
            data-bc-nav-cron
            aria-current={view === 'cron' ? 'page' : undefined}
            onClick={() => { setView('cron') }}
          >
            <span className="bc-web-ui-nav-icon"><CronIcon size={18} /></span>
            <span className="bc-web-ui-nav-label">{t('shell.navCron')}</span>
          </button>
        </nav>

        {/* The OFFICIAL workspace/session browser (ui-workspace): workspace
            selection, creation, management, and the grouped session list. */}
        <div className="bc-web-ui-sidebar-scroll" data-bc-workspace-browser>
          {renderSlot('sidebar.workspaces', { wide: true, expandSidebar: () => {} })}
        </div>

        {/* Footer: the OFFICIAL settings shell trigger (opens the official
            settings panel, where Models / Plugins / 规则与记忆 + Language /
            Appearance all live). */}
        <div className="bc-web-ui-sidebar-footer" data-bc-user>
          {renderSlot('sidebar.settings', { wide: true })}
        </div>
      </aside>
      <main className="bc-web-ui-main" data-bc-main-view={view}>
        {view === 'skills'
          ? <BcSkillsPage upstream={upstream} workspaceOptions={workspaceOptions} t={t} />
          : view === 'cron'
            ? <BcCronPage upstream={upstream} workspaceOptions={workspaceOptions} t={t} />
            : (
              <div className="bc-web-ui-conversation" data-bc-conversation>
                {sessionHeader !== undefined && <BcSessionHeader header={sessionHeader} upstream={upstream} t={t} />}
                {renderSlot('conversation', {})}
              </div>
            )}
      </main>
      {/* Zero-width column keeps the official DetailsPanel subtree mounted (never unmount on close). */}
      <div className="bc-web-ui-details">{renderSlot('details', {})}</div>
      <div className="bc-web-ui-overlay" data-bc-shell-overlay>{renderSlot('shell.overlay', {})}</div>
    </div>
  )
}
