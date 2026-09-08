/**
 * P2-a shell skeleton styles: the frontend-user token system (warm-gray
 * palette, light and dark tables) re-based onto native CSS variables with the
 * `--bc-` prefix, plus the native-CSS rendering of the skeleton — a visual
 * port of reference/demo/frontend-user/src/globals.css + Sidebar.tsx (read-only
 * source; Tailwind is NOT carried over, the artifact contract forbids new
 * dependencies). Delivered as one <style> tag mounted at plugin activation and
 * removed on disposal (the skin-plugin delivery pattern, C7 apply-time branch).
 *
 * Token scope is the frame element itself: the light table lives on
 * `.bc-web-ui-frame`, the dark table on `[data-bc-theme='dark']`, so the
 * skeleton's theme and the official `--dsw-*` surface stay two coexisting
 * systems by design (the "official components follow our palette" bridge is a
 * later card; official tokens still come from the ThemePresenter).
 *
 * P2-f: the primary palette tiers (light + dark tables) interpolate from the
 * build-time branding constants (./branding.ts — single source branding/
 * default/branding.yaml, iron rule 5; the P2-a ruling that --bc-color-primary
 * must be branding-sourced). The scrollbar thumb values stay style-owned:
 * they are DERIVED values (the demo's black thumb is invisible on dark
 * backgrounds — a visibility adaptation, not a brand decision; P2-a ruling
 * note), so they do not belong in the branding file.
 */

import { BRANDING } from './branding.ts'

/** The skeleton stylesheet (token tables + grid frame + sidebar + layers). */
const SHELL_CSS = `
/* ===== Token tables — frontend-user warm-gray system, --bc- prefix ===== */
/* Light table (frontend-user :root defaults). Primary tiers interpolate the
   build-time branding constants (P2-f: single source branding.yaml). */
.bc-web-ui-frame {
  --bc-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui,
    "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Roboto, "Noto Sans",
    sans-serif;
  --bc-font-mono: "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace;

  --bc-color-primary: ${BRANDING.theme.primary};
  --bc-color-primary-hover: ${BRANDING.theme.primaryHover};
  --bc-color-primary-active: ${BRANDING.theme.primaryActive};
  --bc-color-success: #22c55e;
  --bc-color-warning: #f59e0b;
  --bc-color-error: #ef4444;

  --bc-bg-sidebar: #f5f5f5;
  --bc-bg-main: #f8f8f7;
  --bc-bg-card: #ffffff;

  --bc-text-primary: #34322d;
  --bc-text-secondary: #5e5e5b;
  --bc-text-tertiary: #858481;
  --bc-text-muted: #858481;

  --bc-fill-hover: #37352f0a;
  --bc-fill-hover-strong: #37352f0f;
  --bc-fill-active: #37352f14;

  --bc-border: #0000000f;
  --bc-border-strong: #00000024;

  --bc-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
  --bc-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.10);

  --bc-scrollbar-thumb: rgba(0, 0, 0, 0.12);
  --bc-scrollbar-thumb-hover: rgba(0, 0, 0, 0.20);
}
/* Dark table (frontend-user .dark overrides). Primary tiers interpolate the
   branding dark variants; the scrollbar values are DERIVED (dark-background
   visibility adaptation, style-owned — see the module doc). The override is
   keyed off the OFFICIAL data-ds-dark-theme body attribute (the single theme
   source of truth, applied by BcThemePresenter on theme/change), so the
   official Appearance row drives the bc token table too. */
body[data-ds-dark-theme] .bc-web-ui-frame {
  --bc-color-primary: ${BRANDING.theme.primaryDark};
  --bc-color-primary-hover: ${BRANDING.theme.primaryDarkHover};
  --bc-color-primary-active: ${BRANDING.theme.primaryDarkActive};
  --bc-color-success: #4ade80;
  --bc-color-warning: #fbbf24;
  --bc-color-error: #f87171;

  --bc-bg-sidebar: #1c1c1e;
  --bc-bg-main: #242426;
  --bc-bg-card: #2c2c2e;

  --bc-text-primary: #ffffffd9;
  --bc-text-secondary: #ffffffa6;
  --bc-text-tertiary: #ffffff59;
  --bc-text-muted: #ffffff59;

  --bc-fill-hover: rgba(255, 255, 255, 0.06);
  --bc-fill-hover-strong: rgba(255, 255, 255, 0.10);
  --bc-fill-active: rgba(255, 255, 255, 0.14);

  --bc-border: rgba(255, 255, 255, 0.08);
  --bc-border-strong: rgba(255, 255, 255, 0.12);

  --bc-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
  --bc-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

  --bc-scrollbar-thumb: rgba(255, 255, 255, 0.16);
  --bc-scrollbar-thumb-hover: rgba(255, 255, 255, 0.24);
}

/* ===== Frame grid: sidebar 300px (frontend-user real width) + 1fr + 0px ===== */
.bc-web-ui-frame {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 0px;
  height: 100%;
  box-sizing: border-box;
  font-family: var(--bc-font-family);
  -webkit-font-smoothing: antialiased;
  background: var(--bc-bg-main);
  color: var(--bc-text-primary);
  transition: background-color 0.3s ease, color 0.3s ease;
}

/* ===== Sidebar column ===== */
.bc-web-ui-sidebar {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  box-sizing: border-box;
  background: var(--bc-bg-sidebar);
  border-right: 1px solid var(--bc-border);
  transition: background-color 0.3s ease;
}

/* Brand header — 56px, frontend-user geometry; mark paints the branding
   primary (P2-f) and carries the product-name initial (derived from the same
   branding single source — no literal in code), name is the branding-sourced
   product name. */
.bc-web-ui-sidebar-header {
  display: flex;
  height: 56px;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  box-sizing: border-box;
  padding: 12px 10px 12px 12px;
}
.bc-web-ui-brand-mark {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--bc-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: #ffffff;
  user-select: none;
}
.bc-web-ui-brand-name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--bc-text-primary);
}

/* Scrollable middle: nav rows + reserved sessions area. */
.bc-web-ui-sidebar-scroll {
  display: flex;
  flex: 1 1 0;
  min-height: 0;
  flex-direction: column;
  gap: 1px;
  overflow-x: hidden;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 8px 8px 0;
}

/* Nav row — frontend-user NavItem spec: 36px tall, r10, ps-8/pe-2, 20px icon
   box, 14px label, active state = background only (text color unchanged). */
.bc-web-ui-nav-item {
  display: flex;
  height: 36px;
  width: 100%;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 0 2px 0 8px;
  border: none;
  border-radius: 10px;
  background: transparent;
  font: inherit;
  text-align: left;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}
.bc-web-ui-nav-item:hover { background: var(--bc-fill-hover); }
.bc-web-ui-nav-item-active { background: var(--bc-fill-hover); }
.bc-web-ui-nav-icon {
  display: flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}
.bc-web-ui-nav-label {
  min-width: 0;
  flex: 1 1 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--bc-text-primary);
}

/* Nav block wrapper (three page rows, live since P2-e). */
.bc-web-ui-nav-block {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

/* ===== Sessions area (P2-b real data: workspace groups + session rows) ===== */
.bc-web-ui-sessions {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-bottom: 8px;
}
.bc-web-ui-section-header {
  display: flex;
  height: 36px;
  align-items: center;
  box-sizing: border-box;
  padding: 0 2px 0 10px;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  letter-spacing: -0.091px;
  color: var(--bc-text-tertiary);
  user-select: none;
}
.bc-web-ui-empty {
  margin: 0;
  padding: 48px 0;
  text-align: center;
  font-size: 13px;
  color: var(--bc-text-muted);
}

/* Workspace group — header (frontend-user ProjectRow spec: 36px, r10, 14px
   normal label, no chevron — collapsing is a deferred item) + rows. */
.bc-web-ui-workspace-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.bc-web-ui-group-header {
  display: flex;
  height: 36px;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 0 8px 0 8px;
  border-radius: 10px;
  user-select: none;
}
.bc-web-ui-group-title {
  min-width: 0;
  flex: 1 1 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--bc-text-primary);
}
.bc-web-ui-group-count {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 16px;
  color: var(--bc-text-muted);
}

/* Session row — frontend-user ConversationRow spec: h36, r10, ps24/pe2, hover
   fill, active = fill + 6px primary dot, time swaps for the archive button on
   hover (invisible→visible size reveal, the demo's group-hover pattern). */
.bc-web-ui-session-row {
  display: flex;
  height: 36px;
  width: 100%;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 0 2px 0 24px;
  border-radius: 10px;
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}
.bc-web-ui-session-row:hover { background: var(--bc-fill-hover); }
.bc-web-ui-session-row-active { background: var(--bc-fill-hover); }
.bc-web-ui-session-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  margin: 0 -7px 0 -1px;
  border-radius: 50%;
  background: var(--bc-color-primary);
}
.bc-web-ui-session-title {
  min-width: 0;
  flex: 1 1 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 400;
  line-height: 21px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--bc-text-primary);
}
.bc-web-ui-session-time {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 16px;
  color: var(--bc-text-muted);
}
.bc-web-ui-session-archive {
  display: flex;
  width: 0;
  height: 0;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: none;
  padding: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--bc-text-muted);
  font: inherit;
  cursor: pointer;
}
.bc-web-ui-session-row:hover .bc-web-ui-session-time { display: none; }
.bc-web-ui-session-row:hover .bc-web-ui-session-archive { width: 28px; height: 28px; }
.bc-web-ui-session-archive:hover { background: var(--bc-fill-hover-strong); }

/* User footer — the language + theme toggles are its live controls (P2-f). */
.bc-web-ui-sidebar-footer {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 8px;
}
.bc-web-ui-user-avatar {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--bc-fill-hover-strong);
  color: var(--bc-text-muted);
}
.bc-web-ui-user-name {
  min-width: 0;
  flex: 1 1 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--bc-text-primary);
}
.bc-web-ui-theme-toggle {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--bc-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-theme-toggle:hover { background: var(--bc-fill-hover); }
/* Language toggle (P2-f): text chip in the same 28px cell family, sized by
   its content (locale self-labels: zh / English). */
.bc-web-ui-locale-toggle {
  display: flex;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  color: var(--bc-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-locale-toggle:hover { background: var(--bc-fill-hover); }

/* ===== Welcome view (P2-c new-task flow: replaces the main area) =====
   Centered card over the frame's own background — the frontend-user welcome
   page posture, rendered in the --bc- token system. */
.bc-web-ui-welcome {
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 48px 24px;
}
.bc-web-ui-welcome-card {
  display: flex;
  width: 100%;
  max-width: 560px;
  flex-direction: column;
  gap: 20px;
  box-sizing: border-box;
  padding: 32px;
  border: 1px solid var(--bc-border);
  border-radius: 16px;
  background: var(--bc-bg-card);
  box-shadow: var(--bc-shadow-md);
}
.bc-web-ui-welcome-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bc-web-ui-welcome-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  color: var(--bc-text-secondary);
  user-select: none;
}
.bc-web-ui-welcome-select {
  height: 38px;
  box-sizing: border-box;
  border: 1px solid var(--bc-border-strong);
  border-radius: 10px;
  background: var(--bc-bg-card);
  padding: 0 10px;
  font: inherit;
  font-size: 14px;
  color: var(--bc-text-primary);
  cursor: pointer;
}
.bc-web-ui-welcome-select:focus-visible {
  outline: 2px solid var(--bc-color-primary);
  outline-offset: 1px;
}
.bc-web-ui-welcome-textarea {
  box-sizing: border-box;
  border: 1px solid var(--bc-border-strong);
  border-radius: 10px;
  background: var(--bc-bg-card);
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  line-height: 21px;
  color: var(--bc-text-primary);
  resize: vertical;
  min-height: 96px;
}
.bc-web-ui-welcome-textarea:focus-visible {
  outline: 2px solid var(--bc-color-primary);
  outline-offset: 1px;
}
.bc-web-ui-welcome-empty {
  display: flex;
  min-height: 38px;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 6px 10px;
  border: 1px dashed var(--bc-border-strong);
  border-radius: 10px;
  font-size: 14px;
  color: var(--bc-text-secondary);
}
.bc-web-ui-welcome-empty-hint {
  font-size: 12px;
  line-height: 16px;
  color: var(--bc-text-muted);
}
.bc-web-ui-welcome-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}
.bc-web-ui-welcome-submit {
  height: 38px;
  box-sizing: border-box;
  border: none;
  border-radius: 10px;
  background: var(--bc-color-primary);
  padding: 0 20px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-welcome-submit:hover { background: var(--bc-color-primary-hover); }
.bc-web-ui-welcome-submit:active { background: var(--bc-color-primary-active); }
.bc-web-ui-welcome-submit:disabled {
  background: var(--bc-fill-hover-strong);
  color: var(--bc-text-muted);
  cursor: default;
}
.bc-web-ui-welcome-hint {
  font-size: 12px;
  line-height: 16px;
  color: var(--bc-text-muted);
  user-select: none;
}
.bc-web-ui-welcome-error {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--bc-color-error);
}

/* ===== Conversation view (P2-d: self-built session header + official surface) =====
   The wrapper mirrors the official ui-layout center column shape (flex column,
   overflow hidden) so the embedded official conversation root keeps sizing
   itself the way it did under ui-layout; the header rides on top as a
   shrink-0 flex child in the frontend-user ConversationPage header geometry
   (px-6 py-3, 14px/500 title, hairline bottom border). */
.bc-web-ui-conversation {
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.bc-web-ui-session-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  height: 44px;
  /* 右侧预留 99px：dsh-better-sidebar 的开关簇固定悬浮在视口右上角
     （right:10px，两个 28px 按钮 ≈ 60px 宽），头部的「打开/归档」按钮继续
     靠右对齐，但整体让出该保留带（按钮右缘距视口右缘 99px）。 */
  padding: 0 99px 0 24px;
  border-bottom: 1px solid var(--bc-border);
  background: var(--bc-bg-card);
}
.bc-web-ui-session-header-title {
  min-width: 0;
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--bc-text-primary);
  border-radius: 6px;
  cursor: text;
  outline: none;
}
.bc-web-ui-session-header-title:hover,
.bc-web-ui-session-header-title:focus-visible {
  background: var(--bc-fill-hover);
  outline: none;
}
.bc-web-ui-session-rename {
  min-width: 0;
  height: 28px;
  box-sizing: border-box;
  border: 1px solid var(--bc-color-primary);
  border-radius: 6px;
  background: var(--bc-bg-card);
  padding: 0 8px;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--bc-text-primary);
}
.bc-web-ui-session-rename:focus-visible {
  outline: 2px solid var(--bc-color-primary);
  outline-offset: 1px;
}
.bc-web-ui-session-header-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  max-width: 220px;
  height: 22px;
  box-sizing: border-box;
  padding: 0 10px;
  border: 1px solid var(--bc-border);
  border-radius: 999px;
  background: var(--bc-fill-hover);
  font-size: 12px;
  line-height: 20px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--bc-text-secondary);
  user-select: none;
}
.bc-web-ui-session-header-error {
  flex-shrink: 0;
  font-size: 12px;
  line-height: 16px;
  color: var(--bc-color-error);
}
.bc-web-ui-session-header-spacer {
  flex: 1 1 0;
}
.bc-web-ui-session-header-archive {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--bc-text-muted);
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-session-header-archive:hover {
  background: var(--bc-fill-hover-strong);
  color: var(--bc-text-secondary);
}
/* The「打开」split button (default open-with method + chooser). The wrapper is
   the positioning + outside-click containment scope; the menu is an absolute
   popover riding just under the 44px header. */
.bc-web-ui-session-header-open {
  position: relative;
  flex-shrink: 0;
  display: flex;
  align-items: center;
}
.bc-web-ui-session-header-open-button {
  display: flex;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  padding: 0 8px 0 10px;
  border: none;
  border-radius: 6px 0 0 6px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  color: var(--bc-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.bc-web-ui-session-header-open-button:hover:not(:disabled) {
  background: var(--bc-fill-hover-strong);
  color: var(--bc-text-primary);
}
.bc-web-ui-session-header-open-button:disabled {
  color: var(--bc-text-muted);
  cursor: default;
}
.bc-web-ui-session-header-open-button svg {
  flex-shrink: 0;
}
.bc-web-ui-session-header-open-toggle {
  display: flex;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 0 5px;
  border: none;
  border-left: 1px solid var(--bc-border);
  border-radius: 0 6px 6px 0;
  background: transparent;
  color: var(--bc-text-tertiary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.bc-web-ui-session-header-open-toggle:hover,
.bc-web-ui-session-header-open-toggle[aria-expanded="true"] {
  background: var(--bc-fill-hover-strong);
  color: var(--bc-text-primary);
}
.bc-web-ui-session-header-open-toggle-caret {
  transition: transform 0.15s;
}
.bc-web-ui-session-header-open-toggle[aria-expanded="true"] .bc-web-ui-session-header-open-toggle-caret {
  transform: rotate(180deg);
}
.bc-web-ui-session-header-open-menu {
  position: absolute;
  top: calc(100% + 4px);
  right: 0;
  z-index: 10001;
  display: flex;
  min-width: 184px;
  flex-direction: column;
  gap: 2px;
  box-sizing: border-box;
  padding: 4px;
  border: 1px solid var(--bc-border);
  border-radius: 10px;
  background: var(--bc-bg-card);
  box-shadow: var(--bc-shadow-lg);
}
.bc-web-ui-session-header-open-item {
  display: flex;
  height: 32px;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 0 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  text-align: left;
  color: var(--bc-text-primary);
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-session-header-open-item:hover { background: var(--bc-fill-hover); }
.bc-web-ui-session-header-open-item svg {
  flex-shrink: 0;
  color: var(--bc-text-tertiary);
}
/* The default-method checkmark rides the item's right edge and keeps the
   primary color (beats the tertiary svg rule via higher specificity). */
.bc-web-ui-session-header-open-item .bc-web-ui-session-header-open-check {
  margin-left: auto;
  color: var(--bc-color-primary);
}
.bc-web-ui-session-header-open-sep {
  height: 1px;
  margin: 4px 8px;
  flex-shrink: 0;
  background: var(--bc-border);
}

/* ===== Nav pages (P2-e: skills/cron/settings skeletons) =====
   The shared page scaffold (PageScaffold.tsx): frontend-user page geometry —
   header (title 24px/32px semibold + subtitle 13px/20px secondary, 44px top
   / 12px bottom / 40px side padding; a row so the header actions keep a
   stable right-edge slot across tab switches), tab bar (TabButton spec: 40px
   cells, 13px/18px semibold, 24px gaps, active = 2px primary bottom border
   riding the bar hairline), and a scrollable body column. */
.bc-web-ui-page {
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.bc-web-ui-page-header {
  display: flex;
  flex-shrink: 0;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
  padding: 44px 40px 12px;
}
.bc-web-ui-page-header-copy {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  flex-direction: column;
  gap: 4px;
}
.bc-web-ui-page-header-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}
.bc-web-ui-page-title {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  letter-spacing: 0.1px;
  color: var(--bc-text-primary);
}
.bc-web-ui-page-subtitle {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--bc-text-secondary);
}
.bc-web-ui-page-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 24px;
  box-sizing: border-box;
  padding: 0 40px;
  border-bottom: 1px solid var(--bc-border);
}
.bc-web-ui-page-tab {
  position: relative;
  display: flex;
  height: 40px;
  align-items: center;
  border: none;
  background: transparent;
  padding: 0 4px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: var(--bc-text-secondary);
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}
.bc-web-ui-page-tab:hover { color: var(--bc-text-primary); }
.bc-web-ui-page-tab:focus-visible {
  outline: 2px solid var(--bc-color-primary);
  outline-offset: -2px;
  border-radius: 4px;
}
.bc-web-ui-page-tab-active { color: var(--bc-text-primary); }
.bc-web-ui-page-tab-active::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 1px 1px 0 0;
  background: var(--bc-color-primary);
}
.bc-web-ui-page-body {
  min-height: 0;
  flex: 1 1 0;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 24px 40px;
}
.bc-web-ui-page-loading {
  margin: 0;
  padding: 48px 0;
  text-align: center;
  font-size: 13px;
  color: var(--bc-text-muted);
}
/* Shared empty state (frontend-user posture: glyph + primary line + hint). */
.bc-web-ui-page-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 96px 24px;
  text-align: center;
}
.bc-web-ui-page-empty-icon {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  border-radius: 12px;
  background: var(--bc-fill-hover-strong);
  color: var(--bc-text-muted);
}
.bc-web-ui-page-empty-title {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  color: var(--bc-text-primary);
}
.bc-web-ui-page-empty-hint {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  /* secondary (not muted): the hint is the empty state's only explanatory
     line — muted reads ~3.4:1 on white, below AA for 13px body copy. */
  color: var(--bc-text-secondary);
}

/* Skills page rows (installed tab: one row per catalog entry). The row carries
   the frontend-user card posture: a leading initial icon (primary-tinted
   box), hover fill feedback, and a 2-line clamped description (the demo's
   cardDesc spec — raw SKILL.md newlines collapse, long entries stop stretching
   the list). */
.bc-web-ui-page-list {
  display: flex;
  max-width: 720px;
  flex-direction: column;
  gap: 8px;
}
.bc-web-ui-skill-row {
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1px solid var(--bc-border);
  border-radius: 12px;
  background: var(--bc-bg-card);
  transition: background-color 0.15s;
}
.bc-web-ui-skill-row:hover { background: var(--bc-fill-hover); }
.bc-web-ui-skill-row-main {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  align-items: flex-start;
  gap: 12px;
}
.bc-web-ui-skill-icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bc-color-primary) 8%, transparent);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
  color: var(--bc-color-primary);
  user-select: none;
}
.bc-web-ui-skill-row-body {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  flex-direction: column;
  gap: 4px;
}
.bc-web-ui-skill-row-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bc-web-ui-skill-name {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--bc-text-primary);
  word-break: break-all;
}
.bc-web-ui-skill-badge {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--bc-fill-hover-strong);
  font-size: 11px;
  line-height: 16px;
  color: var(--bc-text-muted);
  user-select: none;
}
.bc-web-ui-skill-desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 18px;
  color: var(--bc-text-secondary);
}

/* ===== Center column / details column / overlay layer ===== */
.bc-web-ui-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.bc-web-ui-details {
  min-width: 0;
  overflow: hidden;
}
.bc-web-ui-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  pointer-events: none;
}

/* ===== Minimal scrollbar (frontend-user style), scoped to the sidebar ===== */
.bc-web-ui-sidebar-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
.bc-web-ui-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
.bc-web-ui-sidebar-scroll::-webkit-scrollbar-thumb {
  background-color: var(--bc-scrollbar-thumb);
  border-radius: 2px;
}
.bc-web-ui-sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background-color: var(--bc-scrollbar-thumb-hover);
}

/* Workspace-browser icons go monochrome: the official ui-workspace rows may
   carry colored glyphs; the demo's sidebar grammar is strictly neutral
   (currentColor line icons), so desaturate every svg/img inside the embedded
   official browser (scoped to its data attribute — the skeleton's own nav
   icons are currentColor already and stay untouched above this rule). */
[data-bc-workspace-browser] svg,
[data-bc-workspace-browser] img { filter: grayscale(1); }

/* ===== Modal (skills upload + cron create, P1-4/P1-5) ===== */
.bc-web-ui-modal {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.bc-web-ui-modal-mask {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
}
.bc-web-ui-modal-panel {
  position: relative;
  display: flex;
  width: 680px;
  max-width: calc(100vw - 32px);
  max-height: 90vh;
  flex-direction: column;
  border: 1px solid var(--bc-border);
  border-radius: 16px;
  background: var(--bc-bg-card);
  box-shadow: var(--bc-shadow-lg);
  overflow: hidden;
}
.bc-web-ui-modal-head {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  padding: 18px 24px;
  border-bottom: 1px solid var(--bc-border);
}
.bc-web-ui-modal-title {
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
  color: var(--bc-text-primary);
}
.bc-web-ui-modal-close {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--bc-text-muted);
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-modal-close:hover { background: var(--bc-fill-hover); }
/* The body must contribute its CONTENT height to the auto-height panel
   (flex-basis auto, not 0 — a 0 basis with overflow:auto collapses the body
   to its padding and buries the form in a 40px scroll slit); min-height: 0
   still lets the 90vh cap compress it into scrolling. */
.bc-web-ui-modal-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
  box-sizing: border-box;
  padding: 20px 24px;
}
.bc-web-ui-modal-foot {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  gap: 8px;
  box-sizing: border-box;
  padding: 16px 24px;
  border-top: 1px solid var(--bc-border);
}
.bc-web-ui-modal-cancel {
  height: 32px;
  box-sizing: border-box;
  padding: 0 16px;
  border: 1px solid var(--bc-border-strong);
  border-radius: 8px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--bc-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-modal-cancel:hover { background: var(--bc-fill-hover); }
.bc-web-ui-modal-primary {
  height: 32px;
  box-sizing: border-box;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: var(--bc-color-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: #ffffff;
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-modal-primary:hover { background: var(--bc-color-primary-hover); }
.bc-web-ui-modal-primary:disabled {
  background: var(--bc-fill-hover-strong);
  color: var(--bc-text-muted);
  cursor: default;
}

/* ===== Form fields (modal contents) ===== */
/* Two-column field row (demo CreateTaskModal posture: name+expression,
   workspace+model pairs ride one row in the 680px panel). */
.bc-web-ui-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.bc-web-ui-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
/* The demo's dashed upload zone: a tall click target that carries the picker
   affordance (directory choice via the native picker — no fake drop data). */
.bc-web-ui-upload-drop {
  display: flex;
  height: 120px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-sizing: border-box;
  padding: 0 16px;
  border: 2px dashed var(--bc-border-strong);
  border-radius: 12px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  color: var(--bc-text-muted);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s;
}
.bc-web-ui-upload-drop:hover {
  border-color: var(--bc-color-primary);
  background: color-mix(in srgb, var(--bc-color-primary) 6%, transparent);
}
.bc-web-ui-upload-drop:disabled { cursor: default; }
.bc-web-ui-upload-drop-chosen {
  border-style: solid;
  border-color: var(--bc-color-primary);
}
.bc-web-ui-upload-drop-path {
  max-width: 100%;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--bc-text-primary);
}
.bc-web-ui-upload-drop-hint {
  font-size: 12px;
  line-height: 16px;
  color: var(--bc-text-muted);
}
/* Segmented choice (the demo's pill-button selectors: skill type / scope). */
.bc-web-ui-seg-group {
  display: flex;
  gap: 8px;
}
.bc-web-ui-seg {
  display: flex;
  height: 32px;
  align-items: center;
  box-sizing: border-box;
  padding: 0 14px;
  border: 1px solid var(--bc-border-strong);
  border-radius: 8px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--bc-text-secondary);
  cursor: pointer;
  transition: border-color 0.15s, background-color 0.15s, color 0.15s;
}
.bc-web-ui-seg:hover { border-color: var(--bc-color-primary); }
.bc-web-ui-seg-active {
  border-color: var(--bc-color-primary);
  background: color-mix(in srgb, var(--bc-color-primary) 10%, transparent);
  color: var(--bc-color-primary);
  font-weight: 500;
}
.bc-web-ui-form-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 18px;
  color: var(--bc-text-secondary);
  user-select: none;
}
/* Field-level hint line (demo's 11px muted notes under selects/inputs). */
.bc-web-ui-form-hint {
  font-size: 11px;
  line-height: 16px;
  color: var(--bc-text-muted);
  user-select: none;
}
/* Project multi-select list (upload a skill into several project roots). */
.bc-web-ui-upload-workspaces {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 180px;
  box-sizing: border-box;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--bc-border-strong);
  border-radius: 8px;
  background: var(--bc-bg-main);
}
.bc-web-ui-upload-workspace {
  display: flex;
  min-height: 28px;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: 3px 6px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 20px;
  color: var(--bc-text-primary);
  cursor: pointer;
}
.bc-web-ui-upload-workspace:hover { background: var(--bc-fill-hover); }
.bc-web-ui-upload-workspace input[type="checkbox"] {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--bc-color-primary);
  cursor: pointer;
}
.bc-web-ui-form-input,
.bc-web-ui-form-select {
  height: 36px;
  box-sizing: border-box;
  padding: 0 12px;
  border: 1px solid var(--bc-border-strong);
  border-radius: 8px;
  background: var(--bc-bg-main);
  font: inherit;
  font-size: 13px;
  color: var(--bc-text-primary);
}
.bc-web-ui-form-textarea {
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--bc-border-strong);
  border-radius: 8px;
  background: var(--bc-bg-main);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--bc-text-primary);
  resize: vertical;
}
.bc-web-ui-form-input:focus-visible,
.bc-web-ui-form-select:focus-visible,
.bc-web-ui-form-textarea:focus-visible {
  outline: 2px solid var(--bc-color-primary);
  outline-offset: 1px;
}
.bc-web-ui-form-error {
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--bc-color-error);
}

/* ===== bc Rules & Memory section (rendered inside the official settings shell) ===== */
.bc-web-ui-settings-krm {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  padding: 24px;
}
.bc-web-ui-settings-krm-block {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  box-sizing: border-box;
  padding: 16px;
  border: 1px solid var(--bc-border);
  border-radius: 12px;
  background: var(--bc-bg-card);
}
.bc-web-ui-settings-krm-icon {
  display: flex;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bc-color-primary) 8%, transparent);
  color: var(--bc-color-primary);
}
.bc-web-ui-settings-krm-copy {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  flex-direction: column;
  gap: 4px;
}
.bc-web-ui-settings-krm-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--bc-text-primary);
}
.bc-web-ui-settings-krm-hint {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--bc-text-secondary);
}

/* ---- P3a CRUD: two-tab rules/memory bar + pane + compact empty state ---- */
.bc-web-ui-settings-krm-tabs {
  display: flex;
  flex-shrink: 0;
  gap: 20px;
  border-bottom: 1px solid var(--bc-border);
}
.bc-web-ui-settings-krm-tab {
  position: relative;
  display: flex;
  height: 36px;
  align-items: center;
  border: none;
  background: transparent;
  padding: 0 2px;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  line-height: 18px;
  color: var(--bc-text-secondary);
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}
.bc-web-ui-settings-krm-tab:hover { color: var(--bc-text-primary); }
.bc-web-ui-settings-krm-tab-active { color: var(--bc-text-primary); }
.bc-web-ui-settings-krm-tab-active::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 1px 1px 0 0;
  background: var(--bc-color-primary);
}
.bc-web-ui-settings-krm-pane {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
}
.bc-web-ui-settings-krm-toolbar {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: flex-end;
}
/* Memory master switch group: pinned left via auto margin, CTA stays right. */
.bc-web-ui-settings-krm-master {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
}
.bc-web-ui-settings-krm-master-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--bc-text-primary);
}
.bc-web-ui-settings-krm-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 40px 16px;
  text-align: center;
}
/* Stale-memory warning badge (freshness > threshold): warning-tinted, distinct from the neutral type badge. */
.bc-web-ui-skill-badge-warn {
  background: color-mix(in srgb, var(--bc-color-warning) 14%, transparent);
  color: var(--bc-color-warning);
}
/* Required-field asterisk (feedback Why / How-to-apply). */
.bc-web-ui-form-required {
  color: var(--bc-color-error);
}
.bc-web-ui-form-input-inline {
  max-width: 160px;
}

/* ===== Page CTA + cron rows (P1-4/P1-5) ===== */
/* CTA geometry = the demo's header buttons (h-32, r8, 14px icon, 6px gap). */
.bc-web-ui-page-cta {
  display: inline-flex;
  align-self: flex-start;
  height: 32px;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  padding: 0 16px;
  border: none;
  border-radius: 8px;
  background: var(--bc-color-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: #ffffff;
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-page-cta:hover { background: var(--bc-color-primary-hover); }
.bc-web-ui-cron-row {
  display: flex;
  align-items: center;
  gap: 16px;
  box-sizing: border-box;
  padding: 12px 16px;
  border: 1px solid var(--bc-border);
  border-radius: 12px;
  background: var(--bc-bg-card);
}
.bc-web-ui-cron-row-main {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  flex-direction: column;
  gap: 2px;
}
.bc-web-ui-cron-row-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bc-web-ui-cron-name {
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--bc-text-primary);
}
.bc-web-ui-cron-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  line-height: 18px;
  color: var(--bc-text-secondary);
}
.bc-web-ui-cron-schedule {
  font-weight: 500;
  color: var(--bc-text-secondary);
}
.bc-web-ui-cron-desc {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 12px;
  line-height: 18px;
  color: var(--bc-text-tertiary);
}

/* ===== Toggle switch (task enable/disable, demo TaskRow posture) ===== */
.bc-web-ui-toggle {
  display: flex;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  align-items: center;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--bc-border-strong);
  cursor: pointer;
  transition: background-color 0.15s;
}
.bc-web-ui-toggle-on { background: var(--bc-color-primary); }
.bc-web-ui-toggle:disabled { cursor: default; opacity: 0.5; }
.bc-web-ui-toggle-knob {
  display: block;
  width: 18px;
  height: 18px;
  margin-left: 3px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s;
}
.bc-web-ui-toggle-on .bc-web-ui-toggle-knob { transform: translateX(20px); }

/* ===== Row action buttons (cron tasks + installed skills) ===== */
.bc-web-ui-row-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}
.bc-web-ui-row-action {
  display: flex;
  height: 28px;
  align-items: center;
  box-sizing: border-box;
  padding: 0 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 16px;
  color: var(--bc-text-secondary);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.bc-web-ui-row-action:hover { background: var(--bc-fill-hover-strong); color: var(--bc-text-primary); }
.bc-web-ui-row-action:disabled { opacity: 0.4; cursor: default; }
.bc-web-ui-row-action-danger { color: var(--bc-color-error); }
.bc-web-ui-row-action-danger:hover { background: color-mix(in srgb, var(--bc-color-error) 8%, transparent); color: var(--bc-color-error); }

/* ===== Page toolbar (installed-skills search + project filter) ===== */
.bc-web-ui-page-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}
.bc-web-ui-search {
  display: flex;
  height: 28px;
  width: 200px;
  align-items: center;
  gap: 4px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid var(--bc-border-strong);
  border-radius: 6px;
  background: var(--bc-bg-card);
}
.bc-web-ui-search:focus-within { border-color: var(--bc-color-primary); }
.bc-web-ui-search-input {
  min-width: 0;
  flex: 1 1 0;
  border: none;
  background: transparent;
  font: inherit;
  font-size: 13px;
  line-height: 18px;
  color: var(--bc-text-primary);
  outline: none;
}
.bc-web-ui-search-input::placeholder { color: var(--bc-text-muted); }
.bc-web-ui-search-clear {
  display: flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--bc-text-muted);
  cursor: pointer;
}
.bc-web-ui-search-clear:hover { color: var(--bc-text-primary); }
.bc-web-ui-filter-select {
  height: 28px;
  box-sizing: border-box;
  padding: 0 8px;
  border: 1px solid var(--bc-border-strong);
  border-radius: 6px;
  background: var(--bc-bg-card);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  color: var(--bc-text-secondary);
}
.bc-web-ui-filter-select:focus-visible { outline: 2px solid var(--bc-color-primary); outline-offset: 1px; }

/* ===== Skill row meta (scope + owning-project marker) ===== */
.bc-web-ui-skill-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}
.bc-web-ui-skill-project {
  font-size: 11px;
  line-height: 16px;
  color: var(--bc-text-tertiary);
}

/* ===== Confirm modal (delete task / uninstall skill) ===== */
.bc-web-ui-confirm-panel { width: 360px; }
.bc-web-ui-confirm-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  padding: 24px;
  text-align: center;
}
.bc-web-ui-confirm-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: var(--bc-text-primary);
}
.bc-web-ui-confirm-message {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--bc-text-secondary);
}
.bc-web-ui-confirm-danger { background: var(--bc-color-error); }
.bc-web-ui-confirm-danger:hover { background: color-mix(in srgb, var(--bc-color-error) 85%, #000000); }

/* ===== Transient action notice (run / toggle / delete feedback) ===== */
.bc-web-ui-notice {
  margin: 0 0 12px;
  box-sizing: border-box;
  padding: 8px 12px;
  border: 1px solid var(--bc-border);
  border-radius: 8px;
  background: var(--bc-fill-hover-strong);
  font-size: 13px;
  line-height: 18px;
  color: var(--bc-text-primary);
}
`

/**
 * Mount the skeleton stylesheet into <head>.
 * @returns the removal disposer.
 */
export function mountShellStyles(): () => void {
  const style = document.createElement('style')
  style.dataset.bcWebUi = 'shell'
  style.textContent = SHELL_CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}
