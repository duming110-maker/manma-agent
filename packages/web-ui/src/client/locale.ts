/**
 * `bc` namespace dictionaries: the self-built shell's whole user-visible copy
 * surface (P2-f, iron rule 4). zh is the source of truth for the key set
 * (Chinese-first repo convention); en is checked complete against it — a
 * missing or extra en key is a compile error. Interpolation follows the
 * framework's `{name}` placeholder syntax (the `t(key, params)` seat); the
 * relative-time family composes through `sessions.time.ago` exactly like the
 * official ui-workspace dictionary.
 *
 * Cross-module shared strings (新建会话/未分组/归档/技能/定时任务/设置) are
 * registered once here — the P2-f ledger dedup ruling. Brand strings are NOT
 * dictionary entries: the product name rides the build-time branding constant
 * (see ./branding.ts); 「DSH」 is an upstream product proper noun (P2-e PM
 * ruling) and stays inline where it appears.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  // Shell frame (sidebar chrome + user footer controls).
  'shell.sidebarLabel': '侧栏',
  'shell.newTask': '新建任务',
  'shell.navSkills': '技能',
  'shell.navCron': '定时任务',
  'shell.navSettings': '设置',
  'shell.user': '用户',
  'shell.themeToDark': '切换暗色',
  'shell.themeToLight': '切换亮色',
  'shell.language': '切换语言',

  // Session area (sidebar list + group headers + row time labels).
  'sessions.section': '会话',
  'sessions.empty': '暂无会话',
  'sessions.loading': '加载中…',
  'sessions.ungrouped': '未分组',
  'sessions.new': '新建会话',
  'sessions.archive': '归档',
  'sessions.time.now': '刚刚',
  'sessions.time.minutes': '{n} 分钟',
  'sessions.time.hours': '{n} 小时',
  'sessions.time.days': '{n} 天',
  'sessions.time.months': '{n} 个月',
  'sessions.time.years': '{n} 年',
  'sessions.time.ago': '{t}前',

  // Welcome view (the new-task landing).
  'welcome.workspaceLabel': '工作区',
  'welcome.workspaceLoading': '工作区加载中…',
  'welcome.workspaceEmpty': '暂无工作区',
  'welcome.workspaceEmptyHint': '请先创建工作区，再开始新任务',
  'welcome.taskLabel': '任务',
  'welcome.taskPlaceholder': '描述你的任务…',
  'welcome.submit': '开始任务',
  'welcome.submitting': '创建中…',
  'welcome.submitFailed': '任务创建失败，请重试',
  'welcome.submitHint': 'Ctrl+Enter 发送',
  'welcome.noWorkspaceOption': '（未选择工作区）',

  // Conversation header (rename + badge + archive entry).
  'header.renameHint': '双击重命名',
  'header.renamePlaceholder': '输入会话标题…',
  'header.renameFailed': '重命名失败',

  // Skills page.
  'skills.subtitle': '安装和管理技能，为智能体解锁业务能力',
  'skills.tabMarket': '市场',
  'skills.tabInstalled': '已安装',
  'skills.marketEmptyTitle': '技能市场建设中',
  'skills.marketEmptyHint': '技能市场与安装流将在技能管理插件接入后提供',
  'skills.installedNoSessionTitle': '暂无当前会话',
  'skills.installedNoSessionHint': '技能清单按当前会话的工作区解析——先选择或创建一个会话',
  'skills.installedLoading': '技能清单加载中…',
  'skills.installedErrorTitle': '技能清单加载失败',
  'skills.installedErrorHint': '请稍后重试，或检查服务状态后切换会话刷新',
  'skills.installedEmptyTitle': '当前会话没有可用技能',
  'skills.installedEmptyHint': '在工作区 .agents/skills/ 目录放置带 frontmatter 的 SKILL.md 即可被会话使用',
  'skills.userOnlyBadge': '仅用户可调用',

  // Cron page (all tabs wait for the P4 capability-cron plugin).
  'cron.subtitle': '配置和管理自动化任务，让 AI 按计划执行工作流',
  'cron.tabTemplates': '模板',
  'cron.tabTasks': '任务',
  'cron.tabHistory': '执行记录',
  'cron.templatesEmptyTitle': '定时任务模板等待接入',
  'cron.templatesEmptyHint': '定时任务插件接入后将提供任务模板与创建流',
  'cron.tasksEmptyTitle': '还没有定时任务',
  'cron.tasksEmptyHint': '等待定时任务插件接入后可创建和管理任务',
  'cron.historyEmptyTitle': '暂无执行记录',
  'cron.historyEmptyHint': '任务执行后，每次运行都会记录在这里',

  // Settings page (rules/memory tabs + the DSH entry; 「DSH」is an upstream
  // product proper noun, not our brand — P2-e PM ruling).
  'settings.subtitle': '管理规则、记忆与 DSH 设置',
  'settings.tabRules': '规则',
  'settings.tabMemory': '记忆',
  'settings.rulesEmptyTitle': '规则管理等待接入',
  'settings.rulesEmptyHint': '规则与记忆插件接入后可配置 AI 的行为规则',
  'settings.memoryEmptyTitle': '记忆管理等待接入',
  'settings.memoryEmptyHint': '规则与记忆插件接入后可管理 AI 的长期记忆',
  'settings.dshTitle': 'DSH 设置',
  'settings.dshHint': '官方设置界面（模型、凭证、外观等）的入口待后续版本接入',
  'settings.dshButton': '打开 DSH 设置',
} satisfies Record<string, string>

/** The bc namespace key union. */
export type BcKey = keyof typeof zh

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The self-built shell's whole copy surface (bc-web-ui). */
    bc: BcKey
  }
}

/** English dictionary, checked complete against the zh key set. */
export const en = {
  // Shell frame.
  'shell.sidebarLabel': 'Sidebar',
  'shell.newTask': 'New Task',
  'shell.navSkills': 'Skills',
  'shell.navCron': 'Scheduled Tasks',
  'shell.navSettings': 'Settings',
  'shell.user': 'User',
  'shell.themeToDark': 'Switch to dark',
  'shell.themeToLight': 'Switch to light',
  'shell.language': 'Switch language',

  // Session area.
  'sessions.section': 'Sessions',
  'sessions.empty': 'No sessions yet',
  'sessions.loading': 'Loading…',
  'sessions.ungrouped': 'Ungrouped',
  'sessions.new': 'New session',
  'sessions.archive': 'Archive',
  'sessions.time.now': 'Just now',
  'sessions.time.minutes': '{n} min',
  'sessions.time.hours': '{n} h',
  'sessions.time.days': '{n} d',
  'sessions.time.months': '{n} mo',
  'sessions.time.years': '{n} y',
  'sessions.time.ago': '{t} ago',

  // Welcome view.
  'welcome.workspaceLabel': 'Workspace',
  'welcome.workspaceLoading': 'Loading workspaces…',
  'welcome.workspaceEmpty': 'No workspaces yet',
  'welcome.workspaceEmptyHint': 'Create a workspace first, then start a new task',
  'welcome.taskLabel': 'Task',
  'welcome.taskPlaceholder': 'Describe your task…',
  'welcome.submit': 'Start Task',
  'welcome.submitting': 'Creating…',
  'welcome.submitFailed': 'Task creation failed, please retry',
  'welcome.submitHint': 'Ctrl+Enter to send',
  'welcome.noWorkspaceOption': '(no workspace selected)',

  // Conversation header.
  'header.renameHint': 'Double-click to rename',
  'header.renamePlaceholder': 'Enter a session title…',
  'header.renameFailed': 'Rename failed',

  // Skills page.
  'skills.subtitle': 'Install and manage skills to unlock capabilities for the agent',
  'skills.tabMarket': 'Market',
  'skills.tabInstalled': 'Installed',
  'skills.marketEmptyTitle': 'Skill market under construction',
  'skills.marketEmptyHint': 'The skill market and install flow arrive with the skill-management plugin',
  'skills.installedNoSessionTitle': 'No current session',
  'skills.installedNoSessionHint': 'The skill catalog resolves against the current session\u2019s workspace — select or create a session first',
  'skills.installedLoading': 'Loading skill catalog…',
  'skills.installedErrorTitle': 'Could not load the skill catalog',
  'skills.installedErrorHint': 'Retry later, or check the service status and switch sessions to refresh',
  'skills.installedEmptyTitle': 'No skills available in this session',
  'skills.installedEmptyHint': 'Place a SKILL.md with frontmatter under the workspace .agents/skills/ directory to make it available',
  'skills.userOnlyBadge': 'User-only',

  // Cron page.
  'cron.subtitle': 'Configure and manage automated tasks so the AI runs workflows on schedule',
  'cron.tabTemplates': 'Templates',
  'cron.tabTasks': 'Tasks',
  'cron.tabHistory': 'Run History',
  'cron.templatesEmptyTitle': 'Scheduled-task templates pending',
  'cron.templatesEmptyHint': 'Task templates and the create flow arrive with the scheduled-task plugin',
  'cron.tasksEmptyTitle': 'No scheduled tasks yet',
  'cron.tasksEmptyHint': 'Tasks can be created and managed once the scheduled-task plugin lands',
  'cron.historyEmptyTitle': 'No runs yet',
  'cron.historyEmptyHint': 'Every run of a task is recorded here once executions exist',

  // Settings page.
  'settings.subtitle': 'Manage rules, memory, and DSH settings',
  'settings.tabRules': 'Rules',
  'settings.tabMemory': 'Memory',
  'settings.rulesEmptyTitle': 'Rule management pending',
  'settings.rulesEmptyHint': 'Behavior rules become configurable once the rules-and-memory plugin lands',
  'settings.memoryEmptyTitle': 'Memory management pending',
  'settings.memoryEmptyHint': 'Long-term memory becomes manageable once the rules-and-memory plugin lands',
  'settings.dshTitle': 'DSH Settings',
  'settings.dshHint': 'The official settings UI (models, credentials, appearance) arrives in a later version',
  'settings.dshButton': 'Open DSH Settings',
} satisfies Record<BcKey, string>
