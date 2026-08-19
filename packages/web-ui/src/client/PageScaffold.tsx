/**
 * The shared page scaffold of the P2-e nav pages (skills/cron/settings): the
 * frontend-user page geometry (reference/demo/frontend-user/src/components/
 * SkillsPage.tsx & CronPage.tsx — read-only source) rendered in the --bc-
 * token system — a page header (24px/32px semibold title + 13px/20px
 * secondary subtitle, 40px side padding), a tab bar (frontend-user
 * TabButton spec: 40px cells, 13px/18px semibold labels, 24px gaps, active =
 * primary-colored 2px bottom border riding the bar's hairline), and a
 * scrollable body column. Purely presentational; pages own their tab state.
 */
import type { ReactNode } from 'react'

/** One tab cell declaration. */
export interface BcPageTab {
  /** Stable key (data attribute + state value). */
  key: string
  /** Display label. */
  label: string
}

/** Props of the page scaffold. */
export interface BcPageScaffoldProps {
  /** Page identity for data attributes (skills/cron/settings). */
  pageKey: string
  /** Page title (h1). */
  title: string
  /** Page subtitle (one line under the title). */
  subtitle: string
  /** Tab cells in display order. */
  tabs: readonly BcPageTab[]
  /** The currently active tab key. */
  activeTab: string
  /** Tab switch notification (pages own the state). */
  onTabSelect(tabKey: string): void
  /** The active tab's content. */
  children: ReactNode
}

/**
 * The page scaffold (see module doc): header + tab bar + scrollable body.
 * @param props - page identity, copy, tabs, and the body.
 * @returns the page element tree.
 */
export function BcPageScaffold({ pageKey, title, subtitle, tabs, activeTab, onTabSelect, children }: BcPageScaffoldProps) {
  return (
    <div className="bc-web-ui-page" data-bc-page={pageKey}>
      <header className="bc-web-ui-page-header">
        <h1 className="bc-web-ui-page-title">{title}</h1>
        <p className="bc-web-ui-page-subtitle">{subtitle}</p>
      </header>
      <div className="bc-web-ui-page-tabs" role="tablist" aria-label={title}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            className={tab.key === activeTab
              ? 'bc-web-ui-page-tab bc-web-ui-page-tab-active'
              : 'bc-web-ui-page-tab'}
            data-bc-page-tab={tab.key}
            aria-selected={tab.key === activeTab}
            onClick={() => { onTabSelect(tab.key) }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bc-web-ui-page-body" data-bc-page-body={activeTab}>
        {children}
      </div>
    </div>
  )
}

/** Props of the page empty state. */
export interface BcPageEmptyProps {
  /** Decorative glyph (the page's own icon, muted). */
  icon: ReactNode
  /** Primary line (what is empty). */
  title: string
  /** Secondary line (why / what unblocks it). */
  hint?: string
}

/**
 * The shared empty state (frontend-user page posture: centered glyph + 14px
 * medium primary line + 13px muted hint).
 * @param props - glyph + copy.
 * @returns the empty-state element tree.
 */
export function BcPageEmpty({ icon, title, hint }: BcPageEmptyProps) {
  return (
    <div className="bc-web-ui-page-empty" data-bc-page-empty>
      <span className="bc-web-ui-page-empty-icon" aria-hidden="true">{icon}</span>
      <p className="bc-web-ui-page-empty-title" data-bc-page-empty-title>{title}</p>
      {hint !== undefined && <p className="bc-web-ui-page-empty-hint" data-bc-page-empty-hint>{hint}</p>}
    </div>
  )
}
