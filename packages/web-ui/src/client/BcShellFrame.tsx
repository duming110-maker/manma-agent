/**
 * The P2-a shell skeleton grown its P2-b data half and the P2-c new-task
 * flow: a visual port of the frontend-user sidebar (reference/demo/
 * frontend-user/src/components/Sidebar.tsx — read-only source; the structure
 * and look are ported, not its React 19 / Tailwind / react-router stack).
 * Pure component otherwise — everything still arrives through the framework
 * shares (runtime share + child-slot render share + the registration's
 * adapter inject face).
 *
 * Frame geometry: three-column grid — sidebar at frontend-user's real 300px
 * (the card's 260px figure defers to the source of truth) + the official
 * conversation surface embedded verbatim in the center + a zero-width details
 * column kept mounted (P0-2 semantics: never unmount the DetailsPanel) + a
 * click-through overlay layer.
 *
 * Main-area ownership (P2-c selection, the card's preferred option): frame
 * view state, not routing. 'welcome' renders our own BcWelcomeView (the boot
 * default — docs/03 §5 makes the welcome page the root landing) while the
 * official conversation registration stays valid, simply unrendered;
 * 'conversation' renders the official conversation slot. The hero-slot
 * alternative (injecting into conversation.hero.workspace) was rejected: the
 * hero also renders around a live blank session, so it cannot carry the
 * workspace choice as a precondition — the D7 gate needs our own surface.
 *
 * Transitions: the sidebar's New Task button enters 'welcome' (a pure local
 * switch — the current selection is NOT cleared, so the persisted reopen
 * selection survives an abandoned welcome visit); the welcome submit and a
 * sidebar row click return to 'conversation'. A current-session transition
 * watcher covers opens that do not flow through our own handlers (a restored
 * boot selection; official hero surfaces): a NON-blank session BECOMING
 * current while 'welcome' is shown switches back — the blank exemption keeps
 * the runtime's boot-time auto blank from yanking the welcome view away
 * mid-composition.
 *
 * P2-d navigation finalization: the conversation view is header + embedded
 * official surface, and the no-current rule closes the map — a 'conversation'
 * view whose current selection is gone returns to 'welcome'. The one real
 * install path is archiving the open session: the official object layer
 * sweeps an archived current into the no-session state itself (workspaces
 * service project() — local echo, other tabs, reconnect baseline alike), so
 * this rule only mirrors, never invents, state changes.
 *
 * P2-e additions: the view union grows the three nav pages (skills/cron/
 * settings — skeletons of their own, no router). The two session rules stay
 * scoped to their own views, untouched: the foreign-open watcher still only
 * fires out of 'welcome' (a page visit must not be yanked away by a
 * selection change underneath it), and the no-current rule still only guards
 * 'conversation'. Page switches are pure setView calls — the current session
 * selection is never touched, so a page visit and return leaves the
 * conversation exactly where it was.
 *
 * P2-f additions: every user-visible string renders through the framework's
 * `t` seat (the root registration declares the 'bc' namespace — copy lives
 * in ./locale.ts, zh the key-set source of truth, iron rule 4); the sidebar
 * brand area takes its name from the build-time branding constant
 * (./branding.ts, iron rule 5) resolved per active locale; and the user
 * footer gains the language toggle — one click writes the official
 * locale.preference through the adapter's setLocale (the official settings
 * Language row's exact channel), so bc copy and official components switch
 * in the same revision.
 *
 * Sidebar sections:
 * - brand area: the branding-sourced name + primary-colored mark;
 * - new-task row: live since P2-c (enters the welcome view);
 * - nav area: skills / cron / settings live since P2-e (each a pure view
 *   switch into its own page skeleton);
 * - sessions area: REAL data since P2-b — the official workspaces/sessions
 *   standard feeds, projected into workspace groups by the adapter single
 *   point (see ../adapters/upstream.ts), rendered by BcSessionList;
 * - user area: the language toggle (official locale preference write) and
 *   the theme toggle flipping the frame's own token table (`data-bc-theme`),
 *   persisted under the `bc-agent-theme` localStorage key (frontend-user's
 *   key, a fixed code identifier per docs/03 §9).
 *
 * The official components inside 'conversation'/'details' keep painting with
 * official `--dsw-*` tokens (ThemePresenter-owned); no bridging in this card.
 * The declared-but-unrendered 'sidebar' seat keeps official registrations
 * valid while this frame renders its own sidebar in the left column.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  UpstreamFace, UpstreamFeedProps, UpstreamInjectFace, UpstreamSessionId, UpstreamWorkspaceId,
} from '../adapters/upstream.ts'
import { projectSessionHeader, projectSidebarData, projectWorkspaceOptions } from '../adapters/upstream.ts'
import { BRANDING } from './branding.ts'
import { BcCronPage } from './CronPage.tsx'
import { BcSessionHeader } from './SessionHeader.tsx'
import { BcSessionList } from './SessionList.tsx'
import { BcSettingsPage } from './SettingsPage.tsx'
import { BcSkillsPage } from './SkillsPage.tsx'
import { BcWelcomeView } from './WelcomeView.tsx'
import { CronIcon, MoonIcon, NewTaskIcon, SettingsIcon, SkillsIcon, SunIcon, UserIcon } from './icons.tsx'

/** Full composed props: runtime share + adapter inject face (its hooks compartment arrives as the bound useLocale selector hook) + the `t` seat + child-slot render share. */
export type BcShellFrameProps =
  & PropsRuntime<'root'>
  & UpstreamFeedProps
  & InjectFace<UpstreamInjectFace>
  & PropsLocale<'bc'>
  & PropsRenderSlots<'sidebar' | 'conversation' | 'details' | 'shell.overlay'>

/** localStorage key persisting the skeleton theme (frontend-user's key, fixed code identifier). */
const THEME_STORAGE_KEY = 'bc-agent-theme'

/** The skeleton's own theme union (independent of the official ui-theme system). */
type BcSkeletonTheme = 'light' | 'dark'

/**
 * Main-area view: our welcome content, the official conversation surface, or
 * one of the P2-e nav pages (skills/cron/settings — pure state, no router).
 */
type BcMainView = 'welcome' | 'conversation' | 'skills' | 'cron' | 'settings'

/** Read the persisted theme; absent or foreign values fall back to light. */
function readStoredTheme(): BcSkeletonTheme {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

/** The shell frame (see module doc): P2-a skeleton + P2-b real session area + P2-c new-task flow + P2-d conversation header + P2-f locale/branding. */
export function BcShellFrame({ useSessions, useWorkspaces, useLocale, setLocale, openSession, archiveSession, createSession, promptSession, renameSession, listSessionSkills, t, renderSlot }: BcShellFrameProps) {
  const [theme, setTheme] = useState<BcSkeletonTheme>(readStoredTheme)
  const [view, setView] = useState<BcMainView>('welcome')
  const workspaces = useWorkspaces(state => state)
  const sessions = useSessions(state => state)
  const locale = useLocale(state => state)
  const sidebarData = projectSidebarData(workspaces, sessions)
  const sessionHeader = projectSessionHeader(workspaces, sessions)
  // The adapter face, identity-stable across renders (the inject face's
  // members are registration-time closures): children's fetch effects key on
  // this object, so a per-render rebuild would re-run them every frame.
  const upstream = useMemo<UpstreamFace>(() => ({
    openSession, archiveSession, createSession, promptSession, renameSession, listSessionSkills, setLocale,
  }), [openSession, archiveSession, createSession, promptSession, renameSession, listSessionSkills, setLocale])

  // The sidebar brand name: the branding dictionary resolved per the active
  // locale (a language switch re-renders through the same snapshot revision
  // that drives the `t` seat, so name and copy move together).
  const brandName = locale.active === 'en' ? BRANDING.product.name.en : BRANDING.product.name.zh
  // The language toggle's target: the one other shipped locale, labeled in
  // its own language (the official LocaleDefinition labels — locale-invariant
  // by design, the same source the official settings Language row lists).
  const localeTarget = locale.active === 'zh' ? 'en' : 'zh'
  const localeTargetLabel = locale.locales.find(l => l.id === localeTarget)?.label ?? localeTarget

  const toggleTheme = (): void => {
    const next: BcSkeletonTheme = theme === 'light' ? 'dark' : 'light'
    localStorage.setItem(THEME_STORAGE_KEY, next)
    setTheme(next)
  }

  // Follow foreign opens back into the conversation view — but only on an
  // actual current-session TRANSITION (the ref starts undefined, so a boot
  // restore counts), never on the welcome entry itself (a non-blank session
  // being already current is the normal abandoned-welcome posture and must
  // not bounce the view). A non-blank session BECOMING current while the
  // welcome view is shown means a restored selection or some official
  // surface (hero picker &c.) opened a conversation. Blank transitions are
  // exempt — the boot-time auto blank would otherwise race an early welcome
  // visit — and our own submit/row-click paths switch views explicitly
  // before this watcher could second-guess them.
  const lastCurrent = useRef<UpstreamSessionId | undefined>(undefined)
  useEffect(() => {
    const changed = lastCurrent.current !== sessions.current
    lastCurrent.current = sessions.current
    if (!changed || view !== 'welcome' || sessions.current === undefined) return
    if (sessions.byId[sessions.current]?.blank !== false) return
    setView('conversation')
  }, [view, sessions.current, sessions.byId])

  // The no-current rule (P2-d finalization, the welcome-return half): a
  // 'conversation' view without a current selection goes back to 'welcome' —
  // the official New Session view state this shell renders as its welcome.
  // The sweep that installs this state (archiving the open session) is the
  // object layer's own; this effect only follows it. State-less, it cannot
  // loop: 'welcome' is out of its guard.
  useEffect(() => {
    if (view === 'conversation' && sessions.current === undefined) setView('welcome')
  }, [view, sessions.current])

  /**
   * The welcome submit flow: resolve the session for the chosen workspace
   * (official blank-reuse/create hand-off), open it immediately (before the
   * first prompt, per the P2-c anti-auto-blank note — the selection moves in
   * the same turn the session exists), hand the main area back to the
   * official conversation surface, then send the first message. Creation
   * failures reject into the welcome view's failure state; prompt failures
   * after a successful open belong to the official surface (promptError
   * snapshot / turn errors) and are only consoled here.
   * @param opts - chosen workspace + task text.
   */
  const submitTask = (opts: { workspaceId: UpstreamWorkspaceId; text: string }): Promise<void> =>
    createSession({ workspaceId: opts.workspaceId })
      .then((sessionId) => {
        openSession(sessionId)
        setView('conversation')
        promptSession(sessionId, opts.text).catch((reason: unknown) => {
          console.warn('bc-web-ui: first prompt rejected:', reason)
        })
      })

  return (
    <div className="bc-web-ui-frame" data-bc-theme={theme}>
      <aside className="bc-web-ui-sidebar" data-bc-sidebar aria-label={t('shell.sidebarLabel')}>
        {/* Brand header: branding-sourced name + primary-colored mark (P2-f). */}
        <div className="bc-web-ui-sidebar-header" data-bc-brand-area>
          <span className="bc-web-ui-brand-mark" data-bc-brand aria-hidden="true" />
          <span className="bc-web-ui-brand-name" data-bc-brand-name>{brandName}</span>
        </div>

        {/* Scrollable middle: nav rows + reserved sessions area. */}
        <div className="bc-web-ui-sidebar-scroll">
          <button
            type="button"
            className={view === 'welcome'
              ? 'bc-web-ui-nav-item bc-web-ui-nav-item-active'
              : 'bc-web-ui-nav-item'}
            data-bc-nav-new-task
            data-bc-nav-new-task-active={view === 'welcome' ? 'true' : undefined}
            onClick={() => { setView('welcome') }}
          >
            <span className="bc-web-ui-nav-icon"><NewTaskIcon size={18} /></span>
            <span className="bc-web-ui-nav-label">{t('shell.newTask')}</span>
          </button>
          <nav className="bc-web-ui-nav-block">
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
            <button
              type="button"
              className={view === 'settings'
                ? 'bc-web-ui-nav-item bc-web-ui-nav-item-active'
                : 'bc-web-ui-nav-item'}
              data-bc-nav-settings
              aria-current={view === 'settings' ? 'page' : undefined}
              onClick={() => { setView('settings') }}
            >
              <span className="bc-web-ui-nav-icon"><SettingsIcon size={18} /></span>
              <span className="bc-web-ui-nav-label">{t('shell.navSettings')}</span>
            </button>
          </nav>
          <BcSessionList
            data={sidebarData}
            upstream={upstream}
            current={sessions.current}
            onOpen={() => { setView('conversation') }}
            t={t}
          />
        </div>

        {/* User footer: placeholder identity + language + theme toggles. */}
        <div className="bc-web-ui-sidebar-footer" data-bc-user>
          <span className="bc-web-ui-user-avatar"><UserIcon size={14} /></span>
          <span className="bc-web-ui-user-name">{t('shell.user')}</span>
          <button
            type="button"
            className="bc-web-ui-locale-toggle"
            data-bc-locale-toggle
            onClick={() => { setLocale(localeTarget) }}
            title={t('shell.language')}
          >
            {localeTargetLabel}
          </button>
          <button
            type="button"
            className="bc-web-ui-theme-toggle"
            data-bc-theme-toggle
            onClick={toggleTheme}
            title={theme === 'light' ? t('shell.themeToDark') : t('shell.themeToLight')}
          >
            {theme === 'light' ? <MoonIcon size={16} /> : <SunIcon size={16} />}
          </button>
        </div>
      </aside>
      <main className="bc-web-ui-main" data-bc-main-view={view}>
        {view === 'welcome'
          ? <BcWelcomeView options={projectWorkspaceOptions(workspaces)} onSubmit={submitTask} t={t} />
          : view === 'skills'
            ? <BcSkillsPage sessionId={sessions.current} upstream={upstream} t={t} />
            : view === 'cron'
              ? <BcCronPage t={t} />
              : view === 'settings'
                ? <BcSettingsPage t={t} />
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
