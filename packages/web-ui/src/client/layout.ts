/**
 * Minimal `ctx.layout` face for the spike shell.
 *
 * The official LayoutController (ui-layout) owns panel geometry through the
 * root entry's layout store; the spike frame has a fixed sidebar and a
 * permanently closed details column, so the panel transitions are no-ops.
 * The FACE itself is not optional: the shell's app-shell assembly entry and
 * ui-conversation / ui-sidebar all inject `layout`, and cordis inject waiting
 * has no timeout — without a provider the boot sweep fails loud and the
 * browser stays on the loading page.
 */

/** The outward layout face (`ctx.layout`) this shell provides. */
export interface BcLayoutFace {
  /** Toggle the sidebar panel (no-op: fixed sidebar in the spike frame). */
  toggleSidebar(): void
  /** Open the details panel (no-op: the spike frame keeps the column closed). */
  openDetails(): void
  /** Close the details panel (no-op: already closed). */
  closeDetails(): void
}

/**
 * Create the spike layout face (all transitions no-op).
 * @returns the face provided as `ctx.layout`.
 */
export function createBcLayoutFace(): BcLayoutFace {
  return {
    toggleSidebar() {},
    openDetails() {},
    closeDetails() {},
  }
}
