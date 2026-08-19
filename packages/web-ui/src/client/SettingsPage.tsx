/**
 * The settings page (P2-e): the docs/03 §5 shape — 规则/记忆 two tabs (empty
 * states; capability-krm is P3a, and this card invents no /ext RPC) — plus
 * the 「DSH 设置」 entry block.
 *
 * The DSH entry's P2-e finding (reported to the PM): the official settings UI
 * is SettingsRoot (ui-settings-general), registered into the `sidebar.
 * settings` seat — a seat DECLARED by ui-sidebar's registration (one
 * declarer per slot) and rendered only inside the official SidebarRoot foot;
 * its modal open state is component-local (no service or seat opens it from
 * outside). This shell's root registrant can render only its own declared
 * children, and declaring `sidebar.settings` here would double-declare
 * against ui-sidebar's activation (a load-time throw, boot failure). Per the
 * card's fallback rule the entry therefore renders as a disabled button with
 * an explanatory copy — no hacks around the official mount point.
 */
import { useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { BcPageEmpty, BcPageScaffold, type BcPageTab } from './PageScaffold.tsx'
import { SettingsIcon } from './icons.tsx'

/** Props: the `t` seat (bc namespace; copy lives in ./locale.ts). */
export interface BcSettingsPageProps {
  t: TranslateNS<'bc'>
}

/**
 * The settings page (see module doc): scaffold + the empty tab body + the
 * DSH entry card. Tab state is local.
 * @param props - the `t` seat.
 * @returns the page element tree.
 */
export function BcSettingsPage({ t }: BcSettingsPageProps) {
  const [activeTab, setActiveTab] = useState('rules')
  // The two tabs (docs/03 §5; the DSH entry rides below the tab bodies);
  // labels resolve per render so a locale switch re-labels live.
  const tabs: readonly BcPageTab[] = [
    { key: 'rules', label: t('settings.tabRules') },
    { key: 'memory', label: t('settings.tabMemory') },
  ]
  return (
    <BcPageScaffold
      pageKey="settings"
      title={t('shell.navSettings')}
      subtitle={t('settings.subtitle')}
      tabs={tabs}
      activeTab={activeTab}
      onTabSelect={setActiveTab}
    >
      {activeTab === 'rules'
        ? (
          <BcPageEmpty
            icon={<SettingsIcon size={24} />}
            title={t('settings.rulesEmptyTitle')}
            hint={t('settings.rulesEmptyHint')}
          />
        )
        : (
          <BcPageEmpty
            icon={<SettingsIcon size={24} />}
            title={t('settings.memoryEmptyTitle')}
            hint={t('settings.memoryEmptyHint')}
          />
        )}
      <div className="bc-web-ui-settings-dsh" data-bc-settings-dsh>
        <div className="bc-web-ui-settings-dsh-copy">
          <span className="bc-web-ui-settings-dsh-title">{t('settings.dshTitle')}</span>
          <span className="bc-web-ui-settings-dsh-hint">{t('settings.dshHint')}</span>
        </div>
        <button
          type="button"
          className="bc-web-ui-settings-dsh-button"
          data-bc-dsh-settings-button
          disabled
          title={t('settings.dshHint')}
        >
          {t('settings.dshButton')}
        </button>
      </div>
    </BcPageScaffold>
  )
}
