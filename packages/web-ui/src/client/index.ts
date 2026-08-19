/**
 * bc-web-ui browser half: the self-built shell frame (P0-2 spike geometry,
 * P2-a frontend-user visual skeleton).
 *
 * One register() call contributes BcShellFrame into the runtime's built-in
 * 'root' slot and, in the same breath, re-declares the four child seats the
 * official ui-layout plugin declared (sidebar / conversation / details /
 * shell.overlay) — same keys, kinds, and scopes, so every official
 * conversation-family plugin keeps registering into the seats it knows.
 *
 * Because the ui-layout row is disabled in the bc-agent profile, this plugin
 * also re-seats the two cross-plugin faces ui-layout owned, or the shell
 * would never settle (cordis inject waiting has no timeout and the boot sweep
 * fails loud on any pending entry):
 *
 * - `ctx.layout` (reflect.provide): injected by the shell's own app-shell
 *   assembly entry and by ui-conversation / ui-sidebar.
 * - the theme presenter: projects ui-theme snapshots onto the document
 *   (`body[data-ds-dark-theme]` + alias-token inline overrides), which keeps
 *   the official components' `--dsw-*` palette live.
 *
 * Value imports are restricted to the shell module table (react, react/jsx-runtime)
 * plus the documented runtime `/client` exemption — the browser bundle purity
 * rule; everything else arrives type-only.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the ctx.theme / ctx.locale Context merges and the
// ThemeSnapshot wire type.
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { createUpstreamFace } from '../adapters/upstream.ts'
import { BcShellFrame } from './BcShellFrame.tsx'
import { createBcLayoutFace, type BcLayoutFace } from './layout.ts'
import { en, zh } from './locale.ts'
import { RulesMemorySection } from './RulesMemorySection.tsx'
import { BcThemePresenter } from './theme.ts'
import { mountShellStyles } from './styles.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    // The four child seats mirror ui-layout's declarations verbatim (keys,
    // kinds, scopes). Official registrants (ui-sidebar into 'sidebar',
    // ui-conversation into 'conversation' + 'details') are activation-ordered
    // behind this plugin through the `layout` service this plugin provides.
    /**
     * The left column. Officially OCCUPIED by ui-sidebar's SidebarRoot; the
     * shell frame renders its own skeleton sidebar instead (frontend-user
     * visual port), so the seat stays declared (registrations stay valid)
     * but is not rendered.
     */
    'sidebar': { kind: 'single'; scope: 'root'; owner: BcSidebarOwnerProps }
    /**
     * The official workspace/session browsing region — declared by ui-sidebar
     * upstream, re-declared here because ui-sidebar is disabled. Occupied by
     * the official ui-workspace browser (section header, search, grouped
     * session list, every workspace dialog). Rendered by the shell frame
     * instead of a rebuilt workspace/session list (P1-4).
     */
    'sidebar.workspaces': { kind: 'single'; scope: 'root'; owner: BcSidebarWorkspacesOwnerProps }
    /**
     * The center column, across both the no-session hero and a live
     * conversation. OCCUPIED by ui-conversation's ConversationRoot — the
     * official chat surface this shell embeds (D2).
     */
    'conversation': { kind: 'single'; scope: 'session-maybe'; owner: BcConversationOwnerProps }
    /**
     * The right details column. OCCUPIED by ui-conversation's DetailsPanel;
     * the spike keeps the column closed (zero width, subtree mounted).
     */
    'details': { kind: 'single'; scope: 'session'; owner: BcDetailsOwnerProps }
    /**
     * Frame-wide floating layer, additive and click-through (ui-layout
     * semantics preserved for future shell-level surfaces of our own).
     */
    'shell.overlay': { kind: 'list'; scope: 'root' }
    /**
     * The official settings shell seat — declared by ui-sidebar upstream,
     * re-declared here because ui-sidebar is disabled in the bc profile.
     * Occupied by ui-settings-general's SettingsRoot (gear trigger + the full
     * official settings modal: models / credentials / plugin inventory).
     */
    'sidebar.settings': { kind: 'single'; scope: 'root'; owner: BcSidebarSettingsOwnerProps }
    /**
     * One settings page in the official shell's nav. Declared at runtime by
     * ui-settings-general's SettingsRoot (a child of `sidebar.settings`); the
     * type is re-declared here (mirroring the official `settings.section`
     * contract) because the declaring base package is not in bc's dependency
     * graph. bc registers its 规则与记忆 section into this slot.
     */
    'settings.section': { kind: 'list'; scope: 'root'; owner: BcSettingsSectionOwnerProps }
  }
}

/** Sidebar owner share: the frame's live column state (unused by the spike frame). */
export interface BcSidebarOwnerProps {
  collapsed: boolean
  width: number
}

/** Conversation owner share: business state belongs to the registrant (upstream ConvOwnerProps mirror). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberate empty owner-share anchor
export interface BcConversationOwnerProps {}

/** Details owner share: empty — sessionId arrives as a framework-standard prop (upstream mirror). */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- deliberate empty owner-share anchor
export interface BcDetailsOwnerProps {}

/** Official settings seat owner share: the column wide/rail state (upstream SidebarSettingsOwnerProps mirror). */
export interface BcSidebarSettingsOwnerProps {
  wide: boolean
}

/** Official workspace-browser owner share (upstream SidebarSectionOwnerProps mirror). */
export interface BcSidebarWorkspacesOwnerProps {
  wide: boolean
  expandSidebar: () => void
}

/** Official settings-section owner share (upstream SettingsSectionOwnerProps mirror): the one shell affordance a section receives. */
export interface BcSettingsSectionOwnerProps {
  close: () => void
}

/** Services required by the shell plugin (ui-layout's set + the official data services + the locale registry + the wire root). */
export const inject = ['slots', 'theme', 'sessions', 'workspaces', 'connection', 'locale']

/** Dictionary namespace owned by this plugin (the whole self-built copy surface; zh/en pair lives in ./locale.ts). */
const BC_NS = 'bc'

/**
 * Client plugin body: the locale dictionaries first (iron rule 4 — the `t`
 * seat the root registration below declares needs them registered; the
 * register bump also wakes already-rendered outlets), then shell styles +
 * the `layout` face + the root registration (service first, declaration
 * second — anyone woken by `layout` sees the seats), then the theme
 * presenter. The root registration carries the adapter single point's action
 * face (openSession/archiveSession + the P2-c new-task pair createSession/
 * promptSession + the P2-e skills-page read listSessionSkills + the P2-f
 * locale preference write setLocale riding the same face, plus its hooks
 * compartment binding the locale snapshot into useLocale — iron rule 2:
 * official service calls live only in ../adapters/upstream.ts; `connection`
 * joined the inject list for that skills channel, `locale` for the
 * dictionary registration and the preference write) and the standard
 * useSessions/useWorkspaces feed hooks arrive as framework props.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(BC_NS, { zh, en }), 'bc-web-ui: dictionaries')

  const layout: BcLayoutFace = createBcLayoutFace()
  ctx.effect(() => {
    const disposeStyles = mountShellStyles()
    const disposeService = ctx.reflect.provide('layout', layout)
    const disposeRegistration = ctx.slots.register({
      name: 'root',
      locale: BC_NS,
      children: {
        'sidebar': { kind: 'single', scope: 'root' },
        'conversation': { kind: 'single', scope: 'session-maybe' },
        'details': { kind: 'single', scope: 'session' },
        'shell.overlay': { kind: 'list', scope: 'root' },
        'sidebar.settings': { kind: 'single', scope: 'root' },
        'sidebar.workspaces': { kind: 'single', scope: 'root' },
      },
      inject: () => createUpstreamFace(ctx),
    }, BcShellFrame)
    return () => {
      disposeRegistration()
      // provide()'s disposer settles asynchronously; teardown is fire-and-forget.
      void disposeService()
      disposeStyles()
    }
  }, 'bc-web-ui: styles + layout face + root registration')

  ctx.effect(() => {
    const presenter = new BcThemePresenter()
    presenter.apply(ctx.theme.getTheme())
    const off = ctx.on('theme/change', (snapshot) => { presenter.apply(snapshot) })
    return () => {
      off()
      presenter.dispose()
    }
  }, 'bc-web-ui: theme presenter')

  // The bc 规则与记忆 section rides the official settings shell's section
  // slot (declared by ui-settings-general's SettingsRoot, the same extension
  // point Models / Plugins use); `slots.inject` waits for that declaration.
  const t = ctx.locale.bind(BC_NS)
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'rules-memory',
    order: 30,
    label: () => t('settings.rulesMemoryNav'),
    locale: BC_NS,
  }, RulesMemorySection))
}
