# 04 详细规格

- 版本：v0.8-draft（2026-08-18）
- 上级文档：[README.md](README.md)
- 依赖阅读：[01-background.md](01-background.md)、[03-architecture.md](03-architecture.md)
- v0.5 说明：本版吸收三方评审（deepseek/GLM/kimi）修订，核心变化见 README「三方评审与修订状态」
- v0.6 说明：新增中英双语（zh/en）需求（F10/D14/C10/S10/R22），复用上游 locale 框架，用户内容不做翻译
- v0.7 说明：人工审核后调整——去「库」（跨会话文件归集后置另做方案）、去「知识库」（后置单独规划）；明确原生文件夹选择主交互；补上游未来若内置记忆的应对（R23）
- v0.8 说明：工作区必须手动选择——移除「默认工作区」自动种子，首次启动强制选择工作区（工作文件不落 C 盘）

## 1. 术语与总则

- **dsh**：deepseek-harness 上游。**BC Agent Desktop**：本产品。
- **工作区（workspace）**：用户选定的**项目目录** + 官方 workspaceRegistry 注册记录（v0.5：注册表本体即上游 `workspace.*` 域，canonical path 唯一、含会话分组账户与归档集）；企业定制字段（三段 AI 行为定义/技能绑定）归多用户演进期。代码标识 `workspace`。
- **工作区选择（v0.8）**：首次启动强制选择工作区——原生文件夹选择框选定目录后方可进入会话；不自动创建任何默认工作区（工作文件不落 C 盘/AppData）。
- **自由任务**：v0.2 移除的概念（v0.8.1 `project_id = NULL`）。纯聊天引导用户去 DeepSeek 官网（免费）。
- 所有业务实体的 `id` 用 UUID（官方 WorkspaceId 除外——引用上游生成的 id）；时间戳存 ISO 8601 UTC。
- 多用户预留字段（§4.7）在单用户期恒为默认值，UI 不暴露。

## 2. 功能清单与映射

| # | 功能 | 实现机制 | 上游依赖 | 自建量 |
|---|---|---|---|---|
| F1 | 任务（工作区内会话） | 官方 sessions RPC + 官方工作区分组；会话必须显式选工作区 | session.* 全套、workspace.list | 仅 UI |
| F2 | 工作区 | **上游 workspaceRegistry 为唯一事实源**（v0.5）；capability-workspace 薄层：首次启动强制选工作区 + 业务扩展元数据 | workspace.* 全套、session.create({workspaceId})、host.pickDirectory | 极小 |
| F3 | 技能 | 官方目录模型（全局 + 项目级 `.agents/skills`）原生发现 + capability-skillx 安装/管理流 | skill-filesystem、skill.list | 小 |
| F4 | 定时任务 | capability-cron（**cron-parser 自建调度**，v0.5：timer 无 cron 能力），必选工作区，不选技能 | sessions、permission-presets | 大 |
| F5 | 规则管理 | capability-krm（行为规则注入） | system-prompt 接缝（section→`request/header` 落日志） | 小 |
| F6 | 记忆管理 | capability-krm（四类型+新鲜度+索引注入） | system-prompt 接缝（context→runtime-context 落日志） | 大 |
| F7 | 色调 | web-ui 主题系统 + 官方主题变量覆盖 | `--dsw-*` 变量、settings 镜像 | 小 |
| F8 | DSH 设置/凭证/模型 | 官方 settings UI 内嵌 | settings.*、credentials.*、llm.* | 极小 |
| F9 | 会话搜索（v0.5 新增） | 官方 `session.search` RPC（侧栏搜索框；查询 ≤500 字符，返回 snippet） | session.search | 极小 |
| F10 | 中英双语（v0.6 新增） | 官方组件随官方 `locale` 偏好切换；bc 自研外壳/页面经 `ctx.locale.register(ns, { zh, en })` + `t` seat 渲染 | `ctx.locale`、`locale.preference` 设置 | 中 |

## 3. 功能规格

### 3.1 任务（F1）

- v0.2 起无「自由任务」：所有会话都属于一个工作区。侧栏按工作区分组列出会话（实时来自 `workspace.list` 的 `sessionIds` 有序分组 + `archivedSessionIds` 归档集 + 官方 session 摘要）。
- 首次启动强制选择工作区（v0.8）：无任何工作区时，入口强制走原生文件夹选择框，选定目录后才可进入会话；**不自动创建默认工作区**。`session.create` 必须显式传 `workspaceId`（上游省略参数时落到 Host cwd，会静默落到错误目录）。
- 新建流程：欢迎页输入 → 选工作区（预选最近使用的工作区；无工作区则先创建）→ `session.create({ workspaceId })`（创建即以工作区目录为 cwd 并自动归组，绑定由 cwd 不可变自然不可逆，见 §3.2）→ 需要非默认模型时 `session.selectModel` → 发送。
- 会话操作：重命名（session.rename）、**删除 = `workspace.archiveSession`**（从分组面隐藏、保留日志与账户槽位、可恢复；不留 /ext 隐藏标记，v0.5）、切换、搜索（session.search，侧栏入口）、导出（后置；注意官方形态是 **GET 下载路由返回会话日志 ZIP**，非 JSON RPC，前端调用方式不同）。
- `session.fork`（上游有）本期无产品入口——有意省略，非遗漏。

### 3.2 工作区（F2）

**概念（v0.5 定稿）**：工作区 = 上游 workspaceRegistry 的一条注册记录（canonical 目录路径 + 显示名 + 会话分组账户 + 归档集 + 持久排序）。v0.8.1 的企业定制三段（核心职责/工作风格/工作流程）与创建期技能绑定是**多用户企业版概念，本期不做**（演进期引入，届时经 system-prompt 接缝注入；见 02-goals G3）。

- **唯一事实源 = 上游**：创建/重命名/删除/排序/会话归档/取消归档全部转发官方 `workspace.*` RPC；侧栏分组数据来自 `workspace.list`。**不自建 workspaces/sessionBindings 表**（v0.4 设计，三方评审一致否决——与上游几乎一一对应，重复且制造双事实源）。
- 创建：**原生文件夹选择框为主交互**——`host.pickDirectory` 经上游 `directory-picker-native`（Windows 下即系统 Explorer「选择文件夹」对话框，与普通软件一致）；手输路径为兜底（需先 `host.createDirectory` 建目录）→ `workspace.create({ path })`（幂等：同 canonical path 返回已有工作区 `created: false`；目录不存在/非目录报 `workspace-invalid-path`）。**不自动创建默认工作区**（工作文件不落 C 盘/AppData）；侧栏/设置提供「打开工作区目录」（`host.openPath`）入口。
- 会话绑定：`session.create({ workspaceId })` 创建即绑定（以工作区目录为会话 cwd 并 attach 归组）；**绑定不可逆的语义来源 = 会话 cwd 不可变**（上游 `session-conflict` 保护），不是自建状态机；切换工作区 = 新建会话。
- 隔离与自动生效：cwd 即项目根——上游自动发现 `<项目根>/.agents/skills`（rank 200）与 `.dsh/skills`（rank 100）项目技能（§3.3），文件产出天然按工作区目录隔离。
- 项目根判定（上游行为）：从 cwd 向上找最近含 `.git` 的祖先目录，无 `.git` 时回退所选目录本身——文档化此规则，避免用户困惑。
- 删除：官方 `workspace.delete`（仅移除注册，**目录与用户文件与全部会话日志永不动**；其下会话变为 Ungrouped）。产品语义 = 「取消注册」；bc 扩展表级联软删（`isDeleted`）。**删除最后一个工作区后，下次进入强制重新选择**。归档的会话不丢（账户槽位保留）。
- 上游 workspaceRegistry 本身也是预发布契约：`workspace.*` RPC 进 adapter 触点清单与 S2 冒烟（03 §7）。
- 简化：v0.8.1 审核字段组与分配字段组不建 UI，仅 bc 扩展表保留 `status`（§4.7）。

### 3.3 技能（F3）

- 两 tab（v0.4 去掉「企业级」）：**技能市场** / **已安装**。
- **市场 tab 数据源（v0.5 明确）**：上游社区市场未落地，本期不做对不存在服务的隐性依赖——P3 首版 = **内置静态推荐清单（随应用发布的 JSON 目录）+ 从 URL/zip/目录安装入口**；后续接社区市场（观察上游 roadmap）。
- **目录模型（上游原生支持，零自建发现逻辑）**——共 **7 层**（v0.5 修正：v0.4 只列 4 层）：

| 层级 | 目录 | rank | 说明 |
|---|---|---|---|
| 项目级（dsh） | `<工作区根>/.dsh/skills/` | 100 | 优先级最高 |
| 项目级（共享） | `<工作区根>/.agents/skills/` | 200 | **主推**：与其他 agent 生态（CodeX、Trae、Pi等）共享技能（用户决策） |
| runtime | 进程内注册 | 250 | 上游运行时技能 |
| custom | 配置自定义 | 300 | `customSkillDirs` |
| 全局（dsh） | `~/.dsh/skills/` | 400 | 全局安装默认位置 |
| 全局（共享） | `~/.agents/skills/` | 500 | 上游同样扫描，展示但不主推 |
| bundled | 内置 | 600 | 官方捆绑 |

  - 同名技能按 rank 覆盖（低者胜）；项目技能随会话 cwd **自动生效**（上游 `tool-skill` 传 `session.header.cwd` 给 registry），文件 watcher 自动刷新——装完即用，无需挂载。
  - **「已安装」页口径（v0.5）**：自扫上表第 1/2/5/6 层（用户可管理层）分类展示；runtime/custom/bundled 层技能会话里可用但不在自管清单——页面提供「环境内置（不可管理）」分区或显式口径标注，避免「会话里能用、已安装页看不到」的困惑。
- 安装流程（capability-skillx）：选来源 → 校验 SKILL.md frontmatter → **用户选择安装位置：全局 or 指定工作区**（工作区则落其 `.agents/skills/`）→ 落盘。**对 git 仓库内的工作区，落盘/移动 `.agents/skills` 下目录是在改用户仓库，UI 提示。**
- 已安装管理：capability-skillx 自行扫描目录按层级分类展示（`skill.list` RPC 不暴露来源层级，仅扁平列表——分类靠自扫）；启停（移入**扫描根同级**的 `skills-disabled/` 目录——如 `~/.dsh/skills-disabled/`、`<工作区根>/.agents/skills-disabled/`；**不能放扫描根内子目录**，上游每根仅扫一层但根内一层仍会被发现；移动后同步更新 `installPath` 元数据）+ 使用统计（useCount/lastUsedAt，**以 name 为键，卸载重装/换层级保留**）+ 卸载确认 + 「编辑使用范围」（= 卸载重装到目标层级）。
- 调用：官方 `/name` 手势——**语义（v0.5 修正）：词边界 token、可在消息任意位置**（上游正则扫描全部 text block），不只是前缀；「粘贴不触发」只约束 Chip 下拉交互，用户发送含 `/xxx` 的文本仍会触发技能调用。UI 可在发送前检测正文中的手势 token 并提示。技能 Chip 交互完整移植（v0.8.1 §5.9：`/` 触发下拉、Chip、粘贴不触发、1.5s 关闭、多技能）。
- 简化：审核状态机不建 UI；`status` 字段保留。
- 不采用上游 frontmatter 的 `disable-model-invocation`/`user-invocable: false` 承担「停用」——语义是「隐藏调用面」非「停用」，与移动目录机制不混用。

### 3.4 定时任务（F4）

**三 tab 保留：模板 / 任务 / 执行记录**（数据模型 §4.4）。

- 调度（v0.5 重写）：capability-cron Host 插件内，**cron-parser 类成熟库**解析标准 5 字段表达式、计算下次触发（含时区，库的时区能力 P4 验证并进冒烟）；`cordis-plugin-timer` **仅作毫秒 interval/timeout 底层载体**（其 API 无 cron/时区——v0.4 描述有误，v0.5 修正）。任务表加载到内存调度，增删改即时生效。「最小粒度 5 分钟」为**产品约定**（防打爆 token），与上游 schedule 包无关。
- 触发链路（v0.5 补时序）：timer 到期 → 校验 `enabled/startDate/endDate/timezone` → `session.create({ workspaceId })` → **`session.selectModel`**（`session.create` 无 modelId 入参，模型默认来自 Host 默认配置；任务指定了 `modelName` 时必须显式切换）→ 权限预设（§3.4 末）→ 以任务 `description`（提示词）作为首条消息 `session.prompt` → **跟踪会话至回合完成**（完成判定接缝候选：`agent/turn-stopping` / `agent/status` running→idle / `agent.whenIdle()`，P4 定稿）→ 写执行记录（状态/摘要/耗时/sessionId）。
- **并发与完成判定（v0.5 新增）**：同一任务上一轮 running 时下一轮到点 = **跳过并记 `skipped`**（不排队不并行）；多任务同时到点串行执行（并发上限 1，避免多会话并发争抢 token 与本地资源）；执行中取消 = 调 `session.cancel` 并将执行记录置 `cancelled`。
- 执行摘要：取会话最后一条 assistant 消息截断（≤500 字）作 `resultSummary`；**边界**：无 assistant 消息（如被审批拒绝终止）→ 摘要记「无输出」+ 状态 failed；被取消 → cancelled；以工具调用收尾 → 取其前一 assistant 文本，无则同「无输出」。
- 手动触发：执行记录 tab 提供「立即执行」（跳过 cron 判定，走同一链路并标记 `trigger=manual`）。
- 错过处理（missed schedule）：应用启动时对 `enabled` 任务补跑一次最近错过的触发（补跑语义与时钟回拨/睡眠交互文档化：只补最新一次），历史错过不逐个补。
- **无人值守权限（v0.5 从调研项转为已确认实现项）**：执行会话显式钉 `sandbox/mode = workspace-write` + `approval/policy = never`（经 `setSandboxMode` / `setApprovalPolicy` 两个 canonical setter 直设，落在 `custom` 预设态；**非**默认 `workspace-write` 预设——该预设捆绑 `ask`）（`ApprovalPolicy = 'ask' | 'never'`，`never` = 每个审批请求自动 resolve `rejected`，fail-closed，会话日志留 `approval/asked → approval/decided` 留痕）。**明确取舍：`never` 拒绝一切需审批操作（含只读但需审批的项），无「只读放行」分级**——v0.4「拒绝非只读操作」措辞作废。避开 `danger-full-access` 预设。Windows 下沙箱为 ACL 受限令牌（partial 保证级别，边界见上游 sandbox-windows-acl 文档），威胁模型按此声明。
- 约束 C7 明示：UI 在任务页展示「定时任务仅在应用运行时执行」提示。

### 3.5 规则管理（F5）

- 条目：规则名称 + 内容（自由文本，对 AI 的风格/人设/语气要求）+ 启用开关。
- 注入：启用的规则拼接为「行为规则」段注入（capability-krm，见 §6）。
- 范围：仅全局级（v0.8.1 表 #16 V0.7 简化；v0.4 理由「工作区级行为由 preset 三段承担」已随 preset 移除失效——现理由：单用户版工作区无行为定制概念，工作区差异由 cwd 上下文与项目技能承载；工作区级规则归多用户期与企业定制三段一并评估）。
- 权限类规则（v0.8.1 permission_rules）**不建**：dsh 自带权限/审批体系与权限模式，由官方设置承载（三明治架构的上游等价物）。

### 3.6 记忆管理（F6）

**完整继承 v0.8.1 §6 的分类体系（与已完成前端 UI 一一对应）：**

- 四类型：`user`（身份/偏好/背景）、`feedback`（对 AI 行为的纠正与肯定，强制 Why + How to apply）、`project`（工作区进展/决策/截止日，相对日期必须转绝对日期）、`reference`（外部系统位置/文档/配置）。
- 作用域：全局 / 指定工作区（对齐前端「全局记忆/工作区记忆」双 tab，前端 tab 文案同步更名）。**项目级记忆新增/编辑表单必须选工作区**（下拉选择器，已删除的工作区不显示），查看列表按所选工作区过滤。
- 标题：保留（数据模型 `name` 字段）。作用：列表可扫读（用户一眼识别记忆用途）、索引注入段靠标题让 AI 快速判断相关性。正文 `content` 单独存，标题不替代正文。
- 索引注入：记忆表动态拼接索引段（名称+描述+类型，≤200 行）经 `systemPrompt.context()` 贡献为 user-role runtime-context 快照 —— 对应 v0.8.1「MEMORY.md 动态生成」（明确不是本地文件）。上游装配发生在**每个 step**（`preStep`），provider 每 step 求值、但快照按文本去重后才落 `user/message`：provider 必须按（workspaceId + domain 版本）memoize，避免每 step 重算 ≤200 行索引；`lastAccessedAt` 只在快照实际变化时批量刷新，不随每 step 装配写。
- 新鲜度：每条 `freshnessWarningDays`；**默认 30 天（v0.5 修正：v0.8.1 的 1 天在桌面单用户场景过短——所有记忆一天后即挂警告，警告失去信息量）**；建议 UI 按类型分档预设（project 类 7 天 / reference 类 90 天），条目级可覆盖；以 `updatedAt` 为基准判定（v0.8.1 V0.8.1 修正：不能用 `lastAccessedAt`，否则高频召回的旧记忆永远「新鲜」）；超期条目在索引段附加警告文案（不阻止使用，模板继承 v0.8.1 §6.4.2）。
- 「不该记忆的内容」清单（v0.8.1 §6.5）写入记忆管理页的提示文案（代码可推导的、git 历史、已有规则中的、一次性细节、纯事实查询）。
- 写入方式：**P3 首版仅手动管理**（用户在 UI 增删改查，对齐已完成 UI）；「会话中自动沉淀记忆」（AI 在对话中写记忆）为 P5 后置增强，走模型面工具（tool 注册）；届时低成本查重（标题/正文归一化 + 编辑距离阈值，借鉴 TAM L1 dedup 思想，不引向量）可一并评估。
- 存储与检索：单用户量级下 domain 全量加载 + 内存过滤即可；不引入向量检索（后置，见 §10.1）。
- **上游若未来内置记忆（R23）**：当前上游无内置记忆（stance「不托管记忆服务，走外部 MCP」）。若上游新增，评估「迁移 / 并存 / 收敛」三选一——bc 的「用户主导四类型」与上游可能的「自动沉淀」并不必然冲突，可并存（bc 层做显式管理，上游层做自动），业务数据 export/import 作迁移通道。

### 3.7 色调（F7）

- 完整移植 `frontend-user` 的 CSS 变量令牌体系与亮/暗切换（`bc-agent-theme` 持久化，用户菜单入口）。
- 官方组件跟随：覆盖官方主题 CSS 变量（`--dsw-alias-*`，skin-plugin 已验证的机制），把官方变量映射到我们的令牌；官方深色模式与我们的暗色联动；`--dsw-alias-*` 变量名列入升级盯梢清单（重命名会让换肤层静默失效）。

### 3.8 DSH 设置（F8）

- 设置页提供「DSH 设置」入口，官方 settings UI（含插件管理、模型、凭证）作为内嵌视图/页面嵌入自研外壳。
- 凭证配置沿用上游 4 级优先级（env > UI 保存 > cwd/.env > ~/.dsh/.env）；桌面版默认引导走 UI 保存（已知坑：env 中的失效 key 会压过 UI 保存值并置灰字段，安装包不在系统 env 写任何 DEEPSEEK_API_KEY）。
- 桌面版会话搜索（F9）使用官方 `session.search`（FTS5 索引 web profile 默认 `:memory:` + 不开启——**P2 决策项**：是否 patch 开启持久 FTS；开启需遵守上游约束「禁指向持久化会话库」，默认先不开，用官方默认行为验证搜索可用性）。

### 3.9 多语言（F10）

- **范围**：界面 chrome 与功能文案支持 zh/en 两语言；**不含**用户内容翻译——会话消息、记忆/规则正文、技能 SKILL.md 均保持用户原文（模型可见内容不做机器翻译，避免失真）。
- **官方组件**：conversation/details/settings 等官方 ui-* 组件随官方 `locale` 偏好（设置页 Language 行）自动切换 zh/en——**零自建成本**（上游 `dsh-client-locale` 已内置双语字典 + 双语平衡编译期校验）。
- **bc 自研外壳/页面**：bc-web-ui 为每一文案命名空间（`bc.shell`/`bc.skills`/`bc.cron`/`bc.krm`…）经 `ctx.locale.register(ns, { zh, en })` 注册；组件经 `t`（Translate）标准 seat 渲染。**zh 为 key 集事实源，en 补齐并由上游编译期校验双语平衡**（缺 key/多 key 编译报错）。
- **语言切换**：复用官方设置 Language 行（写 `locale.preference`，持久化于 `settings.yaml`）；bc 用户菜单提供同源快捷入口（调 `ctx.locale.setLocale`）。无 bc 独立语言状态。
- **首次语言**：未显式设置时随浏览器语言（上游 `detectBrowserLocale`，主 subtag 匹配 zh/en）；品牌版可经 branding 配置覆盖默认语言。
- **fail-loud 语义**：上游查找链为「当前语言 → zh 回退 → common → key 原文」，缺词显示 key 原文而非空白——S10 冒烟覆盖 en 态无 key 原文残留。
- **frontend-user 迁移**：现 UI 文案硬编码中文，P2 移植时统一抽取为 locale 字典（机械改写，不改产品文案本身）。

## 4. 数据模型

> **存储分层（v0.5 总则，D4）**：
> - 低量实体（krm 二表 rules+memories / 技能元数据 / 工作区扩展表 / cron 模板）→ `ctx.storage` 的 **`defineDomain` 版本化 domain 机制**（上游 workspace 域示范的标准姿势：name + version + 表定义 + 两阶段写），json 后端（web 组合默认）为每 domain 一个 JSON 文件、整域序列化重写——仅适合低写入频率实体。
> - 高增长实体（**cronExecutions**）→ **插件自有 `node:sqlite` 库**（`$DSH_HOME/bc-agent/business.db`，自管 schema 与迁移，与上游库完全隔离；含保留策略与索引）。
> - 切换红线：单一 domain 文档数 > 5 万或出现分页/倒排需求时，该实体迁入自有库。
> - 字段命名 camelCase；★ 标记多用户预留字段（§4.7）。
> - v0.4 的 workspaces（§4.1）/sessionBindings（§4.2）两表**已删除**（v0.5：上游 workspaceRegistry 为唯一事实源，见 §3.2）。
> - **语言偏好不建 bc 表**（v0.6）：`locale.preference` 存官方 settings（`settings.yaml`，namespace `locale`），bc 无独立语言状态（见 §3.11）。

### 4.1 workspaceExt（v0.5 新：官方工作区的业务扩展薄层）

以官方 WorkspaceId 为键的 KV 表（`defineDomain` domain），仅存上游没有的字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| workspaceId | 官方 WorkspaceId（键） | 引用上游注册记录 |
| status | string | `active`/`archived` ★（多用户期扩展 review 状态机与企业定制三段字段） |
| ownerId | string | ★ 恒 `local` |
| createdAt / updatedAt | ts | |

官方侧已有的字段（path/title/会话分组/排序/归档集）**不在本表重复**；上游 `workspace.delete` 后本表级联软删（`isDeleted`/`deletedAt`）。

### 4.2 cronTemplates / 4.3 cronTasks（domain）/ 4.4 cronExecutions（自有 SQLite）

cronTemplates（domain）：`id/name/description/defaultCronExpr/createdAt`（预置：日报/周报/月度盘点模板，对齐现有 UI mock）。

cronTasks（domain）：

| 字段 | 说明 |
|---|---|
| id / name / description | description=触发时的执行提示词 |
| cronExpression | 标准 5 字段（产品约定最小粒度 5 分钟） |
| timezone | 默认 Asia/Shanghai；实际时区能力取决于所选 cron 库（P4 验证） |
| workspaceId | **必选**，官方 WorkspaceId（v0.4：不选工作区无法创建任务；不配置技能） |
| modelName | 执行模型（触发链路中经 `session.selectModel` 显式设置） |
| skipConfirm | 无人值守（= 钉 `workspace-write` + approval `never`，见 §3.4） |
| enabled / startDate / endDate | 调度门控 |
| lastRunAt / nextRunAt | 冗余，UI 展示 |
| ownerId ★ / status ★ | 预留 |
| createdAt / updatedAt | |

cronExecutions（**自有 SQLite 表**，只增不减）：

`id/taskId/status(running|success|failed|cancelled|skipped)/resultSummary(≤500字)/failReason?/sessionId/trigger(cron|manual|missed)/startedAt/finishedAt`。
**保留策略**：每任务保留最近 200 条，超出滚动清理（后台任务执行）；`skipped` 态对应并发跳过语义（§3.4）。

### 4.5 skillsMeta（domain；v0.5 修正）

`name(键，上游技能名)/level(global|project)/workspaceId?(project 必填，官方 WorkspaceId)/installPath(实际落盘目录，启停移动后同步更新)/status(enabled|disabled|deleted)/source(market|upload|bundled)/useCount/lastUsedAt/description?/version?/ownerId★/createdAt`。
删除策略：技能目录移除 + 元数据保留 `deleted` 态（会话历史引用可追溯）。「编辑使用范围」= 卸载重装到目标层级（level/workspaceId 变更）；**统计（useCount/lastUsedAt）以 name 为键，跨卸载重装/换层级保留**。
市场 tab 数据源 = 随应用发布的静态推荐清单 JSON（§3.3），不入本表。

### 4.6 rules / memories（domain）

rules：`id/name/content/enabled/createdAt/updatedAt`。

memories（对齐 v0.8.1 表 #18 裁剪）：

| 字段 | 说明 |
|---|---|
| id / name / description | name=标题（列表展示 + 索引注入）；description 进索引段 |
| memoryType | user / feedback / project / reference |
| content | Markdown 正文 |
| why / howToApply | feedback 专属（UI 强制） |
| scope / workspaceId? | global / workspace（官方 WorkspaceId） |
| freshnessWarningDays | 默认 30；UI 按类型分档预设（project 7 / reference 90），条目级可覆盖 |
| lastAccessedAt / updatedAt | 新鲜度基准=updatedAt |
| ownerId ★ | 预留 |

## 4.7 多用户预留策略（D11）

- 只保留**零成本**字段：`ownerId`（恒 `local`）、`status`（单用户只用 active/archived|enabled/disabled）。
- 不保留：usage_scope 部门/人员数组、审核字段组、creator 字段组、departments/positions 表 —— 多用户期由 v0.8.1 文档指导重建（该文档永久保留为多用户期权威参考）。
- 判断标准：预留字段不得产生 UI 复杂度或写入分支；否则不预留。
- **工作区数据迁移提示**：多用户期需把上游 workspaceRegistry 数据迁到企业 PG projects 表（含 WorkspaceId 映射），本期备份/导出工具覆盖 workspaceExt（见 02-goals G3）。

## 5. API 面（/ext 通道，capability-core 统一挂载）

**承载（v0.5，D3'）**：优先经 `connection.rpc.handle('/ext', ...)` 注册——继承官方信任栅栏（Host 头 loopback/trustedHosts、`sec-fetch-site: cross-site` 拒绝、Origin 一致性、POST 强制 JSON）与统一 RPC 信封；P0 spike 验证可行性（含与官方 `/api` 通道并存的稳定性）。**退路**：`webServer.register('/ext/*')` 裸路由——capability-core 复刻三项信任检查 + 统一 JSON 错误信封，S3 冒烟覆盖栅栏行为。

统一约定：JSON over HTTP，同源 loopback；错误 `{ code, message }`；列表接口支持 `?q=&page=&pageSize=`（内存过滤/自有库分页）。

```
工作区扩展 GET/PUT /ext/workspace-ext            （仅扩展元数据；CRUD 本体走官方 workspace.*）
定时任务   GET/POST /ext/cron/templates|tasks   GET/PUT/DELETE .../:id
           POST /ext/cron/tasks/:id/trigger （手动）
           GET   /ext/cron/executions?taskId=&page=（自有库分页）
技能元数据 GET /ext/skills-meta    PUT /ext/skills-meta/:name（启停/统计）
           POST /ext/skills/upload（multipart：zip/目录）
规则/记忆   GET/POST /ext/krm/rules|memories   GET/PUT/DELETE .../:id
聚合       GET /ext/app/bootstrap（扩展元数据+任务统计一次拉齐；工作区分组直接用官方 workspace.list）
备份       GET /ext/backup/export  POST /ext/backup/import   （业务数据归档，v0.5 新增）
变更通知   GET /ext/events（轻量轮询游标）或 registerUpgrade WS 广播——P3 定稿（见 §5.1）
```

（v0.4 的 `/ext/workspaces`、`/ext/workspaces/:id/bindings`、`/ext/bindings` **已删除**——官方 `workspace.*` 全覆盖，反向查询由 `workspace.list` 的 `sessionIds` 承担。）

### 5.1 业务态更新通知（v0.5 新增，B7）

官方 `/api/events.*` 只转发上游事件，不带 bc 业务态。两个候选（P3 定稿）：

1. **轻量轮询**：前端对 `/ext/app/bootstrap` 附带版本游标轮询（间隔 5-10s，仅版本比对，变更才拉详情）——实现最简，默认方案；
2. **WS 广播**：`registerUpgrade('/ext/events')` 自建 WS，capability 各写路径广播变更信号——实时性好，多一路连接管理。

首版（P3a）先做轮询；若执行记录 tab 的实时性体验不达预期再升级 WS。

## 6. 注入与落日志机制（F5/F6 规则/记忆 共用；v0.5 重写）

1. capability-krm 在 Host 侧经上游 **system-prompt 注册表**贡献注入内容。**section vs context 选型**：
   - `ctx.systemPrompt.section()`（静态段，进 system prompt）：用于**稳定**内容——行为规则段（用户手动增删，低频变化）。
   - `ctx.systemPrompt.context()`（有序动态上下文，**成为模型历史中的 runtime-context 快照**，user-role）：用于**每会话/按日可变**内容——记忆索引段（新鲜度警告按日变化）。理由：system prompt 任何变化会从第一个变化 token 起使全部会话的前缀缓存（KV cache）失效；context 是 user-role 快照，不污染 system 前缀。
   - 按会话绑定工作区过滤条目：`AssembleContext` 支持 declaration merging（`dsh-agent` 已声明 `agent` 字段，可取会话 cwd → workspaceId）——**P3a 首个验证项**，不可行则退 waterfall（`system-prompt/assemble`）内过滤。
   - **装配频率与去重**：上游在**每个 step**（`preStep`）调用 `assemble()`，section/context 的 `text` provider 每 step 求值；context 快照经 `RuntimeContextProjection` 按文本去重后才落 `user/message`。因此 provider 须按（workspaceId + domain 版本/`updatedAt`）memoize，避免每 step 重算记忆索引。
   - **压缩交互**：context 快照属消息历史、参与上下文压缩（被压缩后 `RuntimeContextProjection` 会在下一步重新投影）。若产品要求记忆索引在长会话压缩后**恒定存在**，需评估改用 section（代价：system 前缀变化使 KV cache 失效）——本期按 context 定稿，P3a 验证压缩后的重建行为。
2. 组装与去向：行为规则段（section）进 system prompt（`header.system`）；记忆索引段（context，含新鲜度警告）经 `renderContextSnapshot` 渲染为 user-role runtime-context 快照——两通道不同。各段上限：规则 8KB / 记忆索引 25KB（对齐 v0.8.1 ≤200 行约束）。preset 三段已随企业定制移除；工作区上下文由 cwd 天然承载。
3. **落日志（v0.5 重写）：不自写会话事件**。上游 `request/header` 事件已把**每次组装后完整渲染的 system prompt** 落盘（`header.system` 字段，initial/resume/change 快照），section 贡献天然包含在内；context 贡献成为模型历史的 sourced runtime-context 快照。C6（model-visible ⟺ logged）由官方接缝自动满足。背景：第三方自定义会话事件读取端默认拒绝重建（需 `ignorable: true`，live 写入面不暴露该参数），事件词汇表明示 out-of-repo 注册面 deferred——自写既不可行也不必要。若未来确需业务事件进日志，正确路径是推动上游开放注册面。
4. 作用域过滤：会话绑定 workspace → 全局条目 + 该 workspace 条目（无自由会话分支，v0.2）。
5. 失败语义：存储读失败时会话启动失败（fail loud，不静默降级为无注入）；**cron 触发链路的注入失败落执行记录 failed 态并标注原因**（不静默吞掉，v0.5 补）。

## 7. 前端规格汇总

- 框架迁移：React 19→18.x（对齐官方 `^18.2.0`，以锁定版本实际解析为准）；Vite 6 构建产物按 `demo/skin-plugin/build.mjs` 约定打包为客户端模块（`window.__ModuleLoader__` 注册壳）或按官方 client 插件打包规范（P0 spike 确定具体形态）。
- 路由结构、页面、组件：沿用 frontend-user 现有实现，替换 mock 数据层为 `/ext` + adapters（官方域走 `/api`，工作区分组走 `workspace.list`）。**库页与知识库 tab 本期不移植**（后置另做方案，v0.7）。
- 新增：会话页嵌入官方 conversation slot 的容器组件；设置页内嵌官方 settings 视图；主题对官方变量的覆盖层；侧栏移除「任务」独立分组（v0.2，并入工作区分组）；侧栏会话搜索入口（F9）；**语言切换：bc 文案走 `ctx.locale` + `t` seat，用户菜单语言快捷入口（F10）**。
- **双 React 实例防线（v0.5，R14）**：构建配置强制单例 React（externals/alias 到官方运行时提供的实例），P0 冒烟含「DevTools 检测不到第二个 React 实例」。
- 技术债清偿：补 `src/lib/utils.ts`；清理 `.next/`；补 typecheck/lint 脚本。
- 品牌白标：所有用户可见品牌字符串从 branding 配置导入，组件与 Host 插件禁止硬编码品牌名（grep 脚本进 S7）；可配/固定清单与机制见 [03-architecture.md §9](03-architecture.md)。

## 8. 分期计划（每期独立可验收）

| 期 | 内容 | 验收标准 |
|---|---|---|
| **P0 可行性 spike** | ① 修复 frontend-user 构建；② 最小布局插件：禁用 ui-layout → 占 root slot → 渲染自研侧栏 + 官方 conversation 子 slot，**并产出官方 ui-* 插件 slot 注册去向清单 + conversation 组件树可覆盖/不可覆盖 CSS 变量清单**（10.3 答复）；③ 打包形态验证（client 插件构建产物在官方 loader 下运行）；④ **`connection.rpc.handle('/ext')` 通道验证**（继承栅栏 + 与 `/api` 并存）；⑤ 工作区机制确认（降级为确认性验证：`session.create({ workspaceId })` → cwd → `.agents/skills` 技能出现在 `skill.list`，并入 S6） | 自研外壳可见、官方对话区可正常收发消息；slot 清单与样式清单落档；/ext 通道可行性有结论；工作区链路确认通过 |
| **P1 桌面壳** | Electron 精简壳（03 §8 范围）+ NSIS 安装包，内装官方 UI（未禁用 ui-layout 的兼容模式）；自带 pnpm patch（node-pty 等）与打包脚本（照抄 demo 解法） | 全新 Windows 机器安装即用；loopback 强制；卸载干净 |
| **P2 外壳移植** | frontend-user 全量移植为 bc-web-ui（**不含库页/知识库 tab**）；P1 壳切换为布局模式；侧栏接真实会话与官方工作区分组（F1+F7+F9+首次启动强制选工作区）；**frontend-user 中文硬编码文案抽取为 bc locale 字典（F10，zh/en 双语）** | 页面骨架全部上线；会话创建（显式选工作区）/发送/切换/重命名/归档真实可用；亮暗主题生效（含官方组件跟随）；**zh/en 切换无中文残留与缺 key（S10）**；双 React 实例冒烟通过 |
| **P3a 业务插件 ①（v0.5 拆分）** | **capability-krm**（F5/F6 规则+记忆 手动管理 + 注入链路） | 注入两段可重建——规则段在 `request/header.header.system`、记忆段在 runtime-context 快照（S4）；工作区作用域过滤生效；context scope 机制有验证结论 |
| **P3b 业务插件 ②（v0.5 拆分）** | **capability-skillx**（F3）+ capability-workspace 薄层收尾 | 技能安装/启停/统计可用（含七层口径标注） |
| **P4 业务插件 ③** | capability-cron（F4；cron-parser 调度 + 并发策略 + 保留策略） | cron 触发全链路（create→selectModel→prompt→完成判定）+ 手动触发 + 执行记录 + missed 补跑 + skipped 并发语义；无人值守预设钉扎生效（越权自动拒绝并留痕）；S5 通过 |
| **P5 发布** | 官方 settings 内嵌完善、自动更新、备份/恢复（export/import）、开源合规（License 审查 + THIRD_PARTY_NOTICES + README）、升级演练（含 S8/S9） | 02-goals §4 发布标准全项；升级演练留档 |

## 9. 风险清单

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | 上游预发布期 API 破坏性变更（RPC 无版本、slot 契约可变、workspaceRegistry/`connection.rpc` 同为预发布） | 高 | D12 锁版本 + adapter 单点 + Host 触点清单 + 冒烟清单；允许锁旧版延期升级 |
| R2 | 官方 conversation slot 与自研外壳的集成边界不如预期（样式/布局/交互冲突） | 高 | P0 spike 前置验证 + **样式审查项（可覆盖变量清单）与 slot 注册去向清单**；退路=兼容模式发布 + 逐块替换延后 |
| R3 | Electron 打包上游 100+ 包：体积、原生模块（node-pty 等）rebuild、ASAR 路径问题；**独立 repo 必须自带上游 workspace 的 pnpm patch 配置** | 高 | 参考项目已验证打包路径（`npmRebuild=false` + prebuilds 校验 + asarUnpack 清单照抄）；P1 实测 |
| R4 | ~~无人值守 cron 的权限接缝不明~~ **（v0.5 已确认）**：`never` 拒绝一切需审批操作（含只读需审批项），无分级放行 | 中 | 已落规格（§3.4：workspace-write + never + 避开 danger-full-access）；执行记录标注拒绝原因；Windows ACL partial 边界引用上游文档 |
| R5 | ~~PDF/Word 知识库导入解析质量~~ **（v0.7 移除：知识库后置另做方案）** | — | — |
| R6 | ~~附件索引依赖上游 attachment 存储格式~~ **（v0.7 移除：库后置另做方案）** | — | — |
| R7 | 上游 License 未确认（开源分发合规） | 中 | P5 前审查 `@deepseek-ai/dsh-*` LICENSE；不符合则调整分发方式 |
| R8 | 资源投入中断（单人项目） | 中 | 分期独立可验收；P1 后任何一期都是可用产品 |
| R9 | 官方 client 插件打包规范文档不足（examples 少） | 低 | skin-plugin 是活教材；P0 验证 |
| R10 | dsh 官方未来出自研桌面版/官方皮肤机制，本项目被上游覆盖 | 低 | 观察上游 roadmap；被覆盖则收敛为皮肤插件继续复用 |
| R11 | ~~工作区核心接缝未验证~~ **（v0.5 关闭）**：`session.create` 原生接受 `workspaceId`/`cwd`（schema 互斥校验，源码已证）；P0 spike ④ 降级为确认性验证（S6） | — | 已关闭 |
| R12 | 品牌残留：默认品牌字符串硬编码或泄漏进品牌版产物 | 中 | 品牌字面量集中于 branding 模块 + grep 脚本（S7 源码与产物双扫） |
| R13 | **上游会话日志格式升级断裂：App 升级后历史会话不可读**（`SESSION_FORMAT_VERSION = 0` 无兼容承诺，新版拒读旧日志且无升级路径） | 高 | 升级演练必含旧日志回归（S9）；预案权 jsonl 文本迁移器（默认后端是纯文本，格式断裂时安装期转换）；盯上游 SESSION_FORMAT_VERSION 变更公告 |
| R14 | 双 React 实例并存导致 slot 间组件互嵌失败 | 中 | 构建强制单例 React（externals/alias）；P0 冒烟含实例检测 |
| R15 | ~~工作区目录扫描失控~~ **（v0.7 移除：库后置另做方案）** | — | — |
| R16 | ~~知识正文落盘两难~~ **（v0.7 移除：知识库后置另做方案）** | — | — |
| R17 | 仅 PowerShell 5.1 的机器上非 ASCII stdin 误解码（中文产品高频场景） | 中 | 安装期检测并引导安装 PowerShell 7；设置页提示 |
| R18 | Electron + Windows ACL runner 特有坑（`process.execPath` 需 `ELECTRON_RUN_AS_NODE` trampoline、控制台窗口闪烁、node-pty asar patch 属上游 workspace 配置） | 中 | 照抄 demo 解法清单（上游 Agent Note 有记录）；独立 repo 自带 pnpm patch |
| R19 | storage domain 版本变化或 json 后端整域重写导致业务数据断裂/性能退化 | 中 | S8 升级演练 + 业务数据 export/import（备份工具兼作迁移通道）；高增长实体已前移自有 SQLite（D4） |
| R20 | `/ext` 自研信任栅栏与上游语义漂移（若退回 webServer.register 路线） | 中 | 优先 `connection.rpc.handle` 继承官方栅栏；退路复刻三检查项并进 S3 冒烟 |
| R21 | 上游 workspaceRegistry 契约变更（采纳官方域引入的新触点） | 中 | `workspace.*` 进 adapter 触点清单与 S2 冒烟；语义变化时薄层适配 |
| R22 | 中英翻译完整性/官方 locale 契约变更（v0.6） | 中 | 上游编译期强制双语平衡（缺/多 en key 编译报错）；S10 冒烟覆盖 en 态无 key 原文残留；locale 契约（`ctx.locale`/`t` seat/`LocaleNamespaceMap`）进盯梢清单 |
| R23 | 上游未来内置记忆/知识能力，与自建 capability-krm 重叠（v0.7 用户问询） | 中 | 盯上游 release note 的记忆/知识相关新能力；一旦上游提供，评估「迁移（业务数据 export/import 作通道）↔ 并存（bc 保留用户主导四类型层）↔ 收敛为薄层」三选一；不进本期 |

## 10. 三方评审决策点结论（v0.5：已决）与遗留验证项

### 10.1 记忆引擎：自建 vs TencentDB-Agent-Memory —— **已决：自建**（三方一致）

否决 TAM 引入的论证成立（哲学不匹配 + 打包/ABI/Node 版本成本 + 持续 token 消耗 + beta 稳定性）。第三条路：**不进 P3**；「自动记忆沉淀」启动时（P5 后）再评估——届时低成本查重（标题/正文归一化 + 编辑距离，不引向量）与 TAM sidecar 重评估一并做。TAM MemoryKnowledge（code-graph/wiki MCP）待知识库单独规划时评估（走 dsh mcp-client，MCP 的正确位置）。

### 10.2 业务存储 —— **已决：分层**（D4）

低量实体 `defineDomain` domain；`cronExecutions` 第一天进自有 `node:sqlite`（json 后端整域重写不适合高增长实体）；切换红线「单 domain > 5 万文档或需分页/倒排」。

### 10.3 对话区嵌入深度 —— **已决：整体嵌入 + CSS 换肤**；P0 已追加两项

slot 清单（各 ui-* 插件注册去向，防禁用 ui-layout 后组件悄悄消失）+ 样式审查（可覆盖/不可覆盖变量清单，硬编码项排逐块替换优先级）。`--dsw-alias-*` 进升级盯梢清单。

### 10.4 会话删除 —— **已决：官方 `workspace.archiveSession`**（D13）

隐藏 + 保留日志 + 保留账户槽位（可恢复）；物理删除确认不做（上游 append-only 铁律）。工作区删除 = 官方 `workspace.delete`（仅取消注册）。

### 10.5 多用户预留 —— **已决：维持 ownerId/status 零成本字段**

部门可见范围（usage_scope）不预留——预留即违反「不产生写入分支」自定标准；真难点在认证与按用户数据隔离（届时 DSH_HOME 策略重估），不在字段层。工作区数据迁移成本已记入 G3。

### 10.6 无人值守权限 —— **已决**（原调研项关闭）

接缝已源码确认：permission-presets 捆绑 `sandbox/mode + approval/policy`、会话级 pin；`ApprovalPolicy='ask'|'never'`、`never` fail-closed。落规格见 §3.4。

### 10.7 其他评审项结论

1. **双通道**：`/ext` 保留（RpcMethodMap 点分表确不可扩展），承载优先 `connection.rpc.handle`（继承栅栏，D3'）；全走自建 WS 否决。业务态通知策略见 §5.1。
2. **P3 拆分**：已拆 P3a（krm 规则+记忆）/ P3b（skillx）/ P4（cron）（§8）。
3. **风险遗漏**：已补 R13–R21。
4. **Windows-first**：上游有原生 Windows CI 门禁，支持成熟度未被低估；三点具体风险（PS5.1 编码 / ACL partial / Electron ACL runner + node-pty patch）已进 R17/R18 与 §6.5。

### 10.8 遗留验证项（进各期 spike，均有明确退路）

| # | 验证项 | 期 | 退路 |
|---|---|---|---|
| V1 | `connection.rpc.handle('/ext')` 可行性（栅栏继承 + 与 `/api` 并存） | P0 | `webServer.register` + 复刻三检查（R20） |
| V2 | `systemPrompt.context()` 的按会话 scope 过滤（AssembleContext 拿 agent/cwd） | P3a | `system-prompt/assemble` waterfall 内过滤 |
| V3 | ~~知识正文落盘（cwd 外）文件工具读取策略~~ **（v0.7 移除：知识库后置）** | — | — |
| V4 | cron 库时区能力（cron-parser 对 IANA 时区的支持） | P4 | 降级 UTC + 本地偏移换算，文档化限制 |
| V5 | 桌面版是否 patch 开启持久 FTS（session.search 索引） | P2 | 用官方默认（`:memory:`）验证搜索可用性后再决策 |
