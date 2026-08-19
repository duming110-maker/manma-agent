/**
 * The sidebar's real session area (P2-b): workspace-grouped session rows fed
 * by the official client-runtime stores through the adapter single point, with
 * the D13 archive action on row hover. Rendering is a visual port of the
 * frontend-user session rows (reference/demo/frontend-user/src/components/
 * Sidebar.tsx — read-only source; ConversationRow spec: 36px tall, r10, hover
 * fill, hover-revealed action button, active dot) and grouping semantics are
 * the official ui-workspace projection re-exported by the adapter
 * (projectSidebarData). The group header follows the frontend-user
 * SectionHeader/ProjectRow spec (36px, 13px medium tertiary, r10).
 *
 * Row click opens the session through the documented ISessions.open channel
 * (the official sidebar wires the same call); the official conversation
 * surface follows the selection. Data is live: initial load, the archive
 * echo, and host-side changes all arrive through the standard feed
 * subscriptions — no polling in this card.
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  UpstreamFace, UpstreamRelativeTime, UpstreamSessionId, UpstreamSidebarData,
  UpstreamSessionRow,
} from '../adapters/upstream.ts'
import { relativeTimeBucket } from '../adapters/upstream.ts'
import { ArchiveIcon } from './icons.tsx'

/** Props: projected sidebar data + the adapter action face + the current id + the `t` seat. */
export interface BcSessionListProps {
  data: UpstreamSidebarData
  upstream: UpstreamFace
  current: UpstreamSessionId | undefined
  /**
   * Notified on every row-open gesture — the frame's hook for returning the
   * main area to the conversation view (the open itself goes through the
   * official channel below).
   */
  onOpen(): void
  /** The frame's `t` seat (bc namespace; copy lives in ./locale.ts). */
  t: TranslateNS<'bc'>
}

/** Exhaustiveness guard for closed unions (repo convention: a widened union fails loud). */
function assertNever(value: never): never {
  throw new Error(`bc-web-ui: unhandled relative-time unit: ${String(value)}`)
}

/**
 * Localize a relative-time bucket (renderer-side, per official design): the
 * official ui-workspace composition — a magnitude label wrapped by the ago
 * form ('now' carries no magnitude).
 * @param t - the bc-namespace translate function.
 * @param bucket - the structured relative time.
 * @returns the localized label.
 */
function formatRelativeTime(t: BcSessionListProps['t'], bucket: UpstreamRelativeTime): string {
  if (bucket.unit === 'now') return t('sessions.time.now')
  const magnitude = (() => {
    switch (bucket.unit) {
      case 'minutes': return t('sessions.time.minutes', { n: bucket.n })
      case 'hours': return t('sessions.time.hours', { n: bucket.n })
      case 'days': return t('sessions.time.days', { n: bucket.n })
      case 'months': return t('sessions.time.months', { n: bucket.n })
      case 'years': return t('sessions.time.years', { n: bucket.n })
      default: return assertNever(bucket.unit)
    }
  })()
  return t('sessions.time.ago', { t: magnitude })
}

/** Row label: blank rows show the localized New-Session placeholder. */
function rowTitle(t: BcSessionListProps['t'], row: UpstreamSessionRow): string {
  return row.blank ? t('sessions.new') : row.title
}

/** Group header label: the ungrouped bucket carries no adapter label. */
function groupLabel(t: BcSessionListProps['t'], label: string): string {
  return label === '' ? t('sessions.ungrouped') : label
}

/**
 * The session area: section header, then workspace groups (or the P2-a empty
 * copy while nothing is there), each row with hover state, relative time, and
 * the hover-revealed archive button.
 * @param props - projected data, action face, current session id, `t` seat.
 * @returns the session area element tree.
 */
export function BcSessionList({ data, upstream, current, onOpen, t }: BcSessionListProps) {
  const now = Date.now()
  if (data.loading) {
    return (
      <div className="bc-web-ui-sessions" data-bc-session-list data-bc-session-state="loading">
        <div className="bc-web-ui-section-header">{t('sessions.section')}</div>
        <p className="bc-web-ui-empty">{t('sessions.loading')}</p>
      </div>
    )
  }
  if (data.groups.length === 0) {
    return (
      <div className="bc-web-ui-sessions" data-bc-session-list data-bc-session-state="empty">
        <div className="bc-web-ui-section-header">{t('sessions.section')}</div>
        <p className="bc-web-ui-empty">{t('sessions.empty')}</p>
      </div>
    )
  }
  return (
    <div className="bc-web-ui-sessions" data-bc-session-list data-bc-session-state="ready">
      <div className="bc-web-ui-section-header">{t('sessions.section')}</div>
      {data.groups.map(group => (
        <section
          key={group.key}
          className="bc-web-ui-workspace-group"
          data-bc-workspace-group={group.key}
          data-bc-ungrouped={group.key === '' ? 'true' : undefined}
        >
          <div className="bc-web-ui-group-header" data-bc-group-header title={groupLabel(t, group.label)}>
            <span className="bc-web-ui-group-title">{groupLabel(t, group.label)}</span>
            <span className="bc-web-ui-group-count" data-bc-group-count>{group.sessions.length}</span>
          </div>
          {group.sessions.map(row => (
            <div
              key={row.id}
              className={row.id === current ? 'bc-web-ui-session-row bc-web-ui-session-row-active' : 'bc-web-ui-session-row'}
              data-bc-session-row={String(row.id)}
              data-bc-session-blank={row.blank ? 'true' : undefined}
              role="button"
              tabIndex={0}
              aria-current={row.id === current ? 'true' : undefined}
              title={rowTitle(t, row)}
              onClick={() => { upstream.openSession(row.id); onOpen() }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') { upstream.openSession(row.id); onOpen() }
              }}
            >
              {row.id === current && <span className="bc-web-ui-session-dot" aria-hidden="true" />}
              <span className="bc-web-ui-session-title">{rowTitle(t, row)}</span>
              <span className="bc-web-ui-session-time">{formatRelativeTime(t, relativeTimeBucket(row.updatedAt, now))}</span>
              <button
                type="button"
                className="bc-web-ui-session-archive"
                data-bc-archive-button
                title={t('sessions.archive')}
                aria-label={t('sessions.archive')}
                onClick={(event) => {
                  event.stopPropagation()
                  upstream.archiveSession(row.id)
                }}
              >
                <ArchiveIcon size={14} />
              </button>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
