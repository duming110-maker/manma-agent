/**
 * The cron page (P2-e): the frontend-user page skeleton with the three docs/
 * 03 §5 tabs (模板/任务/执行记录), all empty states — the cron business
 * domain has no plugin yet (capability-cron is P4; the /ext channel today
 * carries only ext.probe), so this card deliberately renders NO data and
 * invents NO RPC: every tab says it is waiting for the cron plugin.
 * Templates, task rows, execution records, and the create flow land with
 * P4's capability-cron.
 */
import { useState } from 'react'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { BcPageEmpty, BcPageScaffold, type BcPageTab } from './PageScaffold.tsx'
import { CronIcon } from './icons.tsx'

/** Props: the `t` seat (bc namespace; copy lives in ./locale.ts). */
export interface BcCronPageProps {
  t: TranslateNS<'bc'>
}

/**
 * The cron page (see module doc): scaffold + the waiting-for-plugin empty
 * state of the active tab. Tab state is local; nothing else exists yet.
 * @param props - the `t` seat.
 * @returns the page element tree.
 */
export function BcCronPage({ t }: BcCronPageProps) {
  const [activeTab, setActiveTab] = useState('templates')
  // The three tabs (docs/03 §5); labels resolve per render so a locale switch
  // re-labels live.
  const tabs: readonly BcPageTab[] = [
    { key: 'templates', label: t('cron.tabTemplates') },
    { key: 'tasks', label: t('cron.tabTasks') },
    { key: 'history', label: t('cron.tabHistory') },
  ]
  const empty = activeTab === 'templates'
    ? { title: t('cron.templatesEmptyTitle'), hint: t('cron.templatesEmptyHint') }
    : activeTab === 'tasks'
      ? { title: t('cron.tasksEmptyTitle'), hint: t('cron.tasksEmptyHint') }
      : { title: t('cron.historyEmptyTitle'), hint: t('cron.historyEmptyHint') }
  return (
    <BcPageScaffold
      pageKey="cron"
      title={t('shell.navCron')}
      subtitle={t('cron.subtitle')}
      tabs={tabs}
      activeTab={activeTab}
      onTabSelect={setActiveTab}
    >
      <BcPageEmpty icon={<CronIcon size={24} />} title={empty.title} hint={empty.hint} />
    </BcPageScaffold>
  )
}
