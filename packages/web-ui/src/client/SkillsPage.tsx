/**
 * The skills page (P2-e): the frontend-user page skeleton with two tabs —
 * 市场 (market: empty until the P3b skillx plugin lands) and 已安装
 * (installed: REAL data through the official skill channel). The installed
 * catalog is session-coupled by the protocol itself (P0-4: `skill.list`
 * requires sessionId — the host resolves the project root from the session
 * header's cwd), so this page lists the CURRENT session's catalog via the
 * adapter's listSessionSkills (the official connection-service channel the
 * ui-skill '/' source consumes; iron rule 2 — no official call lives here).
 *
 * Card grids, search, upload, install/remove actions are P3b (capability-
 * skillx); this card renders the structure and the real read-only catalog.
 * Fetch lifecycle: one fetch per current-session change (mounted or switched
 * while the page is open), stale-settled by an ignore flag; switching tabs
 * re-renders the settled state without a refetch.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { UpstreamFace, UpstreamSessionId, UpstreamSkillEntry } from '../adapters/upstream.ts'
import { BcPageEmpty, BcPageScaffold, type BcPageTab } from './PageScaffold.tsx'
import { SkillsIcon } from './icons.tsx'

/** The `t` seat type this page consumes (bc namespace). */
type BcTranslate = TranslateNS<'bc'>

/** The installed-tab label rows: one per skill (name + user-only badge,
 * description; whenToUse as the row's tooltip — the wire's optional routing
 * guidance).
 * @param props - one skill entry + the `t` seat.
 * @returns the row element tree.
 */
function SkillRow({ skill, t }: { skill: UpstreamSkillEntry; t: BcTranslate }) {
  const tip = skill.whenToUse !== undefined
    ? `${skill.description}\n${skill.whenToUse}`
    : skill.description
  return (
    <div
      className="bc-web-ui-skill-row"
      data-bc-skill-row={skill.name}
      data-bc-skill-user-only={skill.modelInvocable ? undefined : 'true'}
      title={tip}
    >
      <div className="bc-web-ui-skill-row-head">
        <span className="bc-web-ui-skill-name">{skill.name}</span>
        {skill.modelInvocable || (
          <span className="bc-web-ui-skill-badge">{t('skills.userOnlyBadge')}</span>
        )}
      </div>
      <p className="bc-web-ui-skill-desc">{skill.description}</p>
    </div>
  )
}

/** The installed tab's fetch state (one catalog at a time). */
type CatalogFetch =
  | { status: 'idle' }
  | { status: 'loading'; sessionId: UpstreamSessionId }
  | { status: 'ready'; sessionId: UpstreamSessionId; entries: readonly UpstreamSkillEntry[] }
  | { status: 'error'; sessionId: UpstreamSessionId }

/** Props: the current session id + the adapter action face + the `t` seat. */
export interface BcSkillsPageProps {
  /** The current selection (the catalog's session address); undefined = no session. */
  sessionId: UpstreamSessionId | undefined
  /** The adapter single-point action face (official reads live there). */
  upstream: UpstreamFace
  /** The frame's `t` seat (bc namespace; copy lives in ./locale.ts). */
  t: BcTranslate
}

/**
 * The installed tab's body: no-current coupling state, per-fetch lifecycle
 * (stale fetches — a session switch mid-flight — keep showing loading until
 * the newest request settles), and the ready rows.
 * @param t - the `t` seat.
 * @param sessionId - the current session id (undefined = no session).
 * @param fetch - the fetch state.
 * @returns the tab body element tree.
 */
function InstalledBody(t: BcTranslate, sessionId: UpstreamSessionId | undefined, fetch: CatalogFetch): ReactNode {
  if (sessionId === undefined) {
    return (
      <BcPageEmpty
        icon={<SkillsIcon size={24} />}
        title={t('skills.installedNoSessionTitle')}
        hint={t('skills.installedNoSessionHint')}
      />
    )
  }
  // A fetch for another session id is stale: the newest request is in flight.
  const settled = 'sessionId' in fetch && fetch.sessionId === sessionId ? fetch : undefined
  if (settled === undefined || settled.status === 'loading') {
    return <p className="bc-web-ui-page-loading">{t('skills.installedLoading')}</p>
  }
  if (settled.status === 'error') {
    return (
      <BcPageEmpty
        icon={<SkillsIcon size={24} />}
        title={t('skills.installedErrorTitle')}
        hint={t('skills.installedErrorHint')}
      />
    )
  }
  if (settled.entries.length === 0) {
    return (
      <BcPageEmpty
        icon={<SkillsIcon size={24} />}
        title={t('skills.installedEmptyTitle')}
        hint={t('skills.installedEmptyHint')}
      />
    )
  }
  return (
    <div className="bc-web-ui-page-list">
      {settled.entries.map(skill => <SkillRow key={skill.name} skill={skill} t={t} />)}
    </div>
  )
}

/**
 * The skills page (see module doc): scaffold + the two tab bodies.
 * @param props - current session id + adapter face + `t` seat.
 * @returns the page element tree.
 */
export function BcSkillsPage({ sessionId, upstream, t }: BcSkillsPageProps) {
  const [activeTab, setActiveTab] = useState('market')
  const [fetch, setFetch] = useState<CatalogFetch>({ status: 'idle' })
  // The face through a ref: the fetch effect keys on the SESSION only (the
  // face's members are stable registration-time closures; a props identity
  // churn must not re-fire the catalog fetch).
  const upstreamRef = useRef(upstream)
  upstreamRef.current = upstream

  // One fetch per current-session change; a session switch mid-flight settles
  // the older promise into the ignore flag (only the newest request renders).
  useEffect(() => {
    if (sessionId === undefined) return
    let current = true
    setFetch({ status: 'loading', sessionId })
    upstreamRef.current.listSessionSkills(sessionId).then(
      (entries) => {
        if (current) setFetch({ status: 'ready', sessionId, entries })
      },
      () => {
        if (current) setFetch({ status: 'error', sessionId })
      },
    )
    return () => { current = false }
  }, [sessionId])

  // The two tabs (docs/03 §5: 市场/已安装 — no enterprise tab since v0.4);
  // labels resolve per render so a locale switch re-labels live.
  const tabs: readonly BcPageTab[] = [
    { key: 'market', label: t('skills.tabMarket') },
    { key: 'installed', label: t('skills.tabInstalled') },
  ]

  return (
    <BcPageScaffold
      pageKey="skills"
      title={t('shell.navSkills')}
      subtitle={t('skills.subtitle')}
      tabs={tabs}
      activeTab={activeTab}
      onTabSelect={setActiveTab}
    >
      {activeTab === 'market'
        ? (
          <BcPageEmpty
            icon={<SkillsIcon size={24} />}
            title={t('skills.marketEmptyTitle')}
            hint={t('skills.marketEmptyHint')}
          />
        )
        : InstalledBody(t, sessionId, fetch)}
    </BcPageScaffold>
  )
}
