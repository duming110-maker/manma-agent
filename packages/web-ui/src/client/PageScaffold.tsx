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
  /**
   * Page-level actions pinned at the header's right edge (frontend-user page
   * posture: title block left, CTA right). Rendered by the scaffold so the
   * CTA keeps a stable slot across tab switches — no layout jump.
   */
  actions?: ReactNode
  /** The active tab's content. */
  children: ReactNode
}

/**
 * The page scaffold (see module doc): header + tab bar + scrollable body.
 * @param props - page identity, copy, tabs, optional header actions, and the body.
 * @returns the page element tree.
 */
export function BcPageScaffold({ pageKey, title, subtitle, tabs, activeTab, onTabSelect, actions, children }: BcPageScaffoldProps) {
  return (
    <div className="bc-web-ui-page" data-bc-page={pageKey}>
      <header className="bc-web-ui-page-header">
        <div className="bc-web-ui-page-header-copy">
          <h1 className="bc-web-ui-page-title">{title}</h1>
          <p className="bc-web-ui-page-subtitle">{subtitle}</p>
        </div>
        {actions !== undefined && (
          <div className="bc-web-ui-page-header-actions" data-bc-page-actions>{actions}</div>
        )}
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

/** Props of the shared confirm modal (delete task / uninstall skill). */
export interface BcConfirmModalProps {
  /** Modal heading. */
  title: string
  /** Body copy (a single sentence). */
  message: string
  /** Confirm button label (e.g. 删除 / 卸载). */
  confirmLabel: string
  /** Cancel button label (e.g. 取消). */
  cancelLabel: string
  /** Render the confirm button in the error color. */
  danger?: boolean
  /** Confirm handler (the modal stays open; the caller closes it). */
  onConfirm(): void
  /** Cancel handler. */
  onCancel(): void
}

/**
 * The shared two-button confirm modal (the demo's delete-confirm posture):
 * centered heading + sentence, cancel left / destructive confirm right.
 * @param props - heading, copy, button labels, and handlers.
 * @returns the modal element tree.
 */
export function BcConfirmModal({ title, message, confirmLabel, cancelLabel, danger, onConfirm, onCancel }: BcConfirmModalProps) {
  return (
    <div className="bc-web-ui-modal" role="alertdialog" aria-modal="true" data-bc-confirm-modal>
      <div className="bc-web-ui-modal-mask" aria-hidden="true" onClick={onCancel} />
      <div className="bc-web-ui-modal-panel bc-web-ui-confirm-panel">
        <div className="bc-web-ui-confirm-body">
          <span className="bc-web-ui-confirm-title">{title}</span>
          <p className="bc-web-ui-confirm-message">{message}</p>
        </div>
        <footer className="bc-web-ui-modal-foot">
          <button type="button" className="bc-web-ui-modal-cancel" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={danger ? 'bc-web-ui-modal-primary bc-web-ui-confirm-danger' : 'bc-web-ui-modal-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
