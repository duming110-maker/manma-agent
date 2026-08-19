/**
 * The bc "规则与记忆" settings section, registered into the official settings
 * shell's `settings.section` slot — the same extension point ui-settings-models
 * (Models) and ui-settings-plugins (Plugins) use. Content is two empty-state
 * cards until capability-krm (P3a) lands; this section only establishes the
 * placement inside the official settings navigation.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { MemoryIcon, RulesIcon } from './icons.tsx'

/** Full component props: the section owner share + the `t` seat. */
type RulesMemorySectionProps = PropsRuntime<'settings.section'> & PropsLocale<'bc'>

/**
 * Render the 规则与记忆 section (two empty-state cards until capability-krm).
 * @param props - composed slot props (only `t` is consumed).
 * @returns the section element tree.
 */
export function RulesMemorySection({ t }: RulesMemorySectionProps) {
  return (
    <div className="bc-web-ui-settings-krm" data-bc-settings-krm>
      <section className="bc-web-ui-settings-krm-block">
        <span className="bc-web-ui-settings-krm-icon" aria-hidden="true"><RulesIcon size={20} /></span>
        <div className="bc-web-ui-settings-krm-copy">
          <span className="bc-web-ui-settings-krm-title">{t('settings.rulesEmptyTitle')}</span>
          <p className="bc-web-ui-settings-krm-hint">{t('settings.rulesEmptyHint')}</p>
        </div>
      </section>
      <section className="bc-web-ui-settings-krm-block">
        <span className="bc-web-ui-settings-krm-icon" aria-hidden="true"><MemoryIcon size={20} /></span>
        <div className="bc-web-ui-settings-krm-copy">
          <span className="bc-web-ui-settings-krm-title">{t('settings.memoryEmptyTitle')}</span>
          <p className="bc-web-ui-settings-krm-hint">{t('settings.memoryEmptyHint')}</p>
        </div>
      </section>
    </div>
  )
}
