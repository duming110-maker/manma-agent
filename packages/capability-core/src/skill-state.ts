/**
 * Persisted skill-module state: the `bc_skills` domain currently holds only the
 * global-skills master switch (docs/04-spec §3.3 的「启用全局技能」/ §4.5
 * skillsMeta 的零成本字段), mirroring the krm memory master switch. The skill
 * directories themselves live on the filesystem; this domain stores user
 * toggles that survive restarts.
 *
 * 全局开关默认关闭：关闭时 `skills.list` 隐藏全局技能、且不允许安装/移动到
 * 全局根（fail-closed，见 index.ts 的门控）。旧文件 `global: null` 视为从未写
 * 入，直接 serve `initial`——加开关不需要 bump 版本。
 *
 * @module @bc-agent/capability-core/skill-state
 */

import { z } from 'zod'
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'

/** 全局技能开关状态：`globalSkillsEnabled` false = 全局技能隐藏且不可安装。 */
export const skillsGlobalState = z.object({
  globalSkillsEnabled: z.boolean(),
})

/** 全局单例推断类型。 */
export type SkillsGlobalState = z.infer<typeof skillsGlobalState>

/** `bc_skills` 域声明：仅全局单例，版本 1。 */
export const skillsDomainSpec = defineDomain({
  name: 'bc_skills',
  version: 1,
  global: {
    schema: skillsGlobalState,
    initial: { globalSkillsEnabled: false },
  },
  tables: {},
})