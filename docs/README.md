# BC Agent 桌面版规格文档（v0.9.1，归档收口）

- 版本：v0.9.1（2026-08-28；v0.8 评审基线 → v0.9 加现状对照与技能标准 → v0.9.1 将 01–05 五篇规划正文冻结归档至 [spec-v0.8-archive/](spec-v0.8-archive/README.md)，本 README 收口为现役唯一入口）
- 状态：基础功能已落地（技能、定时任务、规则、记忆、安装包；代码事实见 [现状与规划对照](#现状与规划对照v09)）；开发前先读对照表，避免按已归档规划开工
- 评审方式：将现役文档 + [spec-v0.8-archive/05-references.md](spec-v0.8-archive/05-references.md) 中列出的外部材料一并交给评审 AI / 评审人

## 现状与规划对照（v0.9）

> 本套规格撰写于 2026-08-18（P0 前，已冻结归档）。下表是**开发期事实基线**（代码现状以 main 分支当前 HEAD 为准）：开发新功能前先读它，文档与代码的分层以本表为界。

### 功能对照

| 功能 | 文档定位 | 代码现状 | 差距 → 下一步 |
|---|---|---|---|
| 会话/对话区 | F1（P2） | 官方 ui-conversation 嵌入（bc 壳渲染 + 会话头） | 无差距 |
| 工作区/会话列表 | F2（P0/P2） | 侧栏嵌官方 ui-workspace 浏览器（P1-4 修订；自研 SessionList.tsx 已删） | 无差距 |
| 新建任务 | F1 | 官方 `startSession` + 官方 hero（自研 WelcomeView.tsx 已删） | 文档 §5 路由描述过时，以本表为准 |
| 技能管理 | F3（P3b） | capability-core `/ext`：安装/卸载/编辑/移动/复制/列表（global+project）+ frontmatter 校验 + 技能市场（GitHub 拉取）+ 内置 skill-creator 可用 | 缺：启停、useCount 统计、七层口径标注（P3b-2） |
| 定时任务 | F4（P4） | cron-parser 调度引擎 + 到点真起会话（workspace-write + never 无人值守对）+ 防重叠 + 运行记录（JSON，上限 200 条）可用 | 缺：任务存储迁 `ctx.storage`（P4-1）、执行记录 SQLite 化（P4-5，暂缓） |
| 规则 | F5（P3a） | capability-core `bc_krm` 域 + `/ext krm.rules.*` + 设置页规则 CRUD + `systemPrompt.section()` 注入 | 无差距 |
| 记忆 | F6（P3a） | capability-core `bc_krm` 域 + `/ext krm.memories.*` + 设置页记忆 CRUD（四类型/作用域/新鲜度/开关）+ `systemPrompt.context()` 索引注入（工作区过滤）+ **AI 自动沉淀**（`bc_write_memory` 工具，总开关门控 + 去重） | 无差距 |
| 设置/凭证/模型 | F8（P5 完善） | 官方 settings 内嵌（bc「规则与记忆」section 已挂官方导航） | 无差距 |
| 色调/皮肤 | F7（P2） | `--bc-*` 令牌 + branding 主色（编译期）+ 官方 `--dsw-*` 覆盖 | 皮肤插件化后置 |
| 双语 | F10（P2） | zh/en 字典 + `t` seat（bc 命名空间） | S10 冒烟未落地 |
| 桌面壳/安装包 | P1（Electron+NSIS） | Electron 壳（spawn dsh 子进程 + per-brand DSH_HOME + ELECTRON_RUN_AS_NODE）+ NSIS 安装包（`BC-Agent-<ver>-x64-Setup.exe`）+ 插件 tarball 首启安装 + sourcemap + 白标 | 核心通过（P1-0）；自动更新/托盘增强/PS7 检测/真机 NSIS 交互验证留 P5 |
| 文件打开方式 | 未编号（后加） | 独立插件 `@bc-agent/file-open`：包装文档化 `ctx.apiProxy.host.openPath`，JSON 配置自定义打开方式 | 设计上无 UI（手改 `$DSH_HOME/bc-file-open.json`） |

### 结构对照（文档 vs 代码）

- 文档规划 6 个包（web-ui / capability-core / -workspace / -cron / -skillx / -krm），**代码实际 3 个**：`capability-core` 以 MVP 合并了 workspace 薄层、技能管理、定时任务、规则/记忆（krm）；`file-open` 为后加的独立小插件。
- 文档 F3/F4 的完整形态（skillx 管理流、cron 引擎）仍是**规划**，当前代码是**可用的 MVP**——两者以本表为界，开发时不得混为一谈。
- `apps/frontend-user/` 保留为移植参考（不参与构建分发）。

### 下一步开发基线（执行视图见 `任务看板.md`）

1. **P2-f 收尾**（文案抽取 zh/en + S10 双语冒烟，P2-0 总卡待验收）
2. **P3b-2/3**（技能启停 + useCount、首次启动强制选工作区）
3. P5 发布：S1–S10 冒烟脚本落地、备份 + 自动更新 + 合规 + 升级演练（P5-0 未拆解）

## 路径映射（迁入独立仓库后）

本套文档撰写时位于上游仓库工作副本内，其中引用的路径按上游仓库书写。**归档正文（spec-v0.8-archive/ 与 spike/）中的 `demo/...`、`packages/...` 等均为历史写法**，迁入本仓库后路径对应关系如下：

| 文档中写法 | 本仓库对应 |
|---|---|
| `demo/...` | `reference/demo/...` |
| `demo/docs/...` | `reference/design/...` |
| `packages/...`、`apps/...`、`docs/...`（上游） | `reference/upstream/packages/...`、`reference/upstream/apps/...`、`reference/upstream/docs/...` |

## 一句话定位

把用户自研的 Web 前端（`demo/frontend-user`）作为 deepseek-harness（下称 dsh）的插件化外壳，做成**单用户、本地数据、可开源分发的桌面安装版**；上游 dsh 核心代码零修改，通过标准插件机制集成，保证上游快速迭代时可低成本跟进。

## 文档结构

| 文件 | 内容 | 评审重点 |
|---|---|---|
| [06-skill-standard.md](06-skill-standard.md) | SKILL.md 编写标准（frontmatter 契约 + description 写法 + 技能市场清单格式） | 技能改动以此为准 |
| [任务看板.md](任务看板.md) | 开发任务卡与状态（执行视图） | 任务推进唯一驱动入口 |
| [产品方案-202608.md](产品方案-202608.md) | 立项/成本论证（面向决策者，PDF 为对外快照） | 演进路线与成本测算 |
| [spike/](spike/) | P0 spike 结论存档（slot/打包/通道/工作区源码级事实） | 上游升级时逐条重核 |
| [spec-v0.8-archive/](spec-v0.8-archive/README.md) | **冻结存档**：01-background / 02-goals / 03-architecture / 04-spec / 05-references 五篇规划正文 | 仅作历史权威；G2 与 S1–S10 冒烟清单的权威定义在此 |

## AI 开发规范正典

AI 开发规范（技能 / 决策留痕 / 角色提示词）正典在仓库根 **`.claude/`**（`skills/`、`notes/`、`roles/`，已入 git）：
- `.agents/skills` 与 `.trae/skills` 仅为指向 `.claude/skills/<name>` 的 Windows junction 桥（前者是 dsh 项目技能发现根，后者供 Trae 读取），不入库，clone 后经 `scripts/setup-agent-links.ps1` 重建。
- 仓库根规范文件是 `CLAUDE.md`（原 AGENTS.md 已并入）。

## 三方评审与修订状态（v0.5）

本方案经三个模型（deepseek / GLM / kimi）独立评审，各自出具源码级核查报告。三方**一致**的问题已全部修订进 v0.5：

| # | 三方一致结论 | v0.5 落点 |
|---|---|---|
| 1 | 上游已内置完整工作区域（`workspace.*` RPC + `ctx.workspaceRegistry` + `session.create({workspaceId})`），自建两表属重复建设 | F2 改「上游唯一事实源 + bc 薄层」，删 workspaces/sessionBindings 表与 `/ext/workspaces`（[04-spec §3.2](spec-v0.8-archive/04-spec.md)） |
| 2 | 会话删除应直接用官方 `workspace.archiveSession`（隐藏 + 保留日志 + 可恢复） | §3.1 改写，撤销 /ext 隐藏标记 |
| 3 | 注入落日志：第三方自定义会话事件当前不可写也不必写——官方 `request/header` 事件已落盘完整渲染后的 system prompt，C6 天然满足 | §6 改写，S4 冒烟改为验证 `request/header.header.system` + runtime-context 快照 |
| 4 | R11 关闭：`session.create` 原生接受 `workspaceId`/`cwd`（互斥校验） | 风险清单改写，P0 spike ④ 降级为确认性验证 |
| 5 | 无人值守权限接缝已确认：permission-presets 捆绑 `sandbox/mode + approval/policy`，`'never'` fail-closed 自动拒绝 | §10.6 从调研项转实现项，§3.4 落规格 |
| 6 | `cordis-plugin-timer` 不支持 cron（仅毫秒 timeout/interval），调度需自建 cron 解析 | §3.4 改写（引入 cron-parser 类库 + timer 作载体） |
| 7 | P3 过重应拆分 | §8 改为 P3a（krm）/ P3b（skillx） |
| 8 | 业务存储分层：低量实体走 `ctx.storage` domain，高增长实体（执行记录）第一天进自有 `node:sqlite` | §4 开头总则 + D4 改写 |

另吸收各评审独有问题（storage/会话日志升级断裂演练、`/ext` 承载改 `connection.rpc.handle` 继承官方栅栏、库扫描忽略规则、知识正文落盘两难、cron 时序与并发、技能七层口径、Windows 三点风险、品牌独立 DSH_HOME 等），详见 [04-spec §9/§10](spec-v0.8-archive/04-spec.md)。

## 配套外部材料（评审时应查阅）

| 材料 | 路径 |
|---|---|
| 多用户版架构设计 v0.8.1（领域模型来源） | `reference/design/BC Agent 系统架构设计方案 v0.8.1.md` |
| 自研前端（UI 移植来源） | `reference/demo/frontend-user/` |
| dsh 上游源码（含文档） | `reference/upstream/docs/`、`reference/upstream/packages/` |
| 桌面化参考项目 | `reference/demo/deepseek-harness-desktop/` |
| 皮肤插件教学示例 | `reference/demo/skin-plugin/` |
| TencentDB-Agent-Memory | **未入镜像**（已从 `upstream.json` demoDirs 移除；评估结论见 [spec-v0.8-archive/05-references.md §3](spec-v0.8-archive/05-references.md)） |

> 注：三方评审报告（`deepseek评审/`、`GLM评审问题/`、`kimi评审/`）与人工审核清单已于 2026-08-19 清理删除（结论已吸收进 v0.5 修订；原文可从 git 历史找回）。

## 已定案的关键决策（评审时可挑战，但需给出理由）

1. 不用 AgentScope 2.0 —— dsh 完全替代其 Agent 引擎角色（用户决策）。
2. 单用户先行，开源发布，多用户待企业实际需求出现再做（用户决策）。
3. 上游 dsh 核心零修改，所有定制走插件 + profile 叠加。
4. 对话区嵌入官方组件，后期按需逐块替换；外壳、导航、页面、色调全部自研。
5. 桌面壳借鉴 `deepseek-harness-desktop` 思路自建精简版，不 fork 它。
6. 企业功能（技能审核流、部门/人员分配范围）简化为单用户版：数据模型保留字段，UI 先做单用户流程。
7. 记忆：自建 SQLite 四类型记忆（对齐前端 UI 与 v0.8.1 §6 设计），TencentDB-Agent-Memory 不直接引入（三方评审一致同意）。
8. 「工作事项」更名「工作区」，对齐官方 dsh workspace 概念（v0.2，用户决策；v0.5 进一步：直接复用上游 workspace 域）。
9. 「自由任务」（无工作区会话）不实现：本产品定位干活，纯聊天用 DeepSeek 官网（免费）；会话必须显式选择工作区（v0.8 起无「默认工作区」兜底，用户决策）。
10. 白标可配置：用户可见品牌（名称/图标/安装包/更新源）经 `branding/` 单一配置替换，一套源码出多品牌版；npm scope、存储键、磁盘路径等代码标识符固定不随品牌变（v0.3，用户需求：服务多家企业）。
11. 工作区 = 官方一致的项目目录选择（v0.4）：v0.8.1 的企业定制三段（职责/风格/流程）与创建期技能绑定归多用户演进期；不生成 preset。
12. 技能模型对齐上游目录（v0.4）：无「企业级」tab，仅技能市场 + 已安装；安装时选全局（`~/.dsh/skills`）或项目（`<工作区根>/.agents/skills`，与其他 agent 生态共享）；项目技能随会话 cwd 自动生效（上游原生）。
13. 定时任务必选工作区、不配置技能（v0.4）：单用户版是通用 agent，技能由工作区 + 全局安装自动供给。
14. **（v0.5）工作区数据层复用上游 `workspace.*` 域**：上游 workspaceRegistry 为唯一事实源；bc 仅保留「首次启动强制选工作区 + 业务扩展薄表（status/ownerId 等）」，以官方 WorkspaceId 为键（三方评审一致）。
15. **（v0.5）会话删除 = 官方 `workspace.archiveSession`**：隐藏 + 保留日志 + 保留工作区账户槽位（可恢复）；不提供物理删除（上游 append-only 铁律，合规角度正确）。
16. **（v0.5）注入与落日志走官方 system-prompt 接缝**：krm 规则/记忆经 `ctx.systemPrompt` 贡献，落日志依赖官方接缝：section → `request/header.header.system`（渲染后完整 system prompt），context → runtime-context `user/message` 快照；不自写会话事件（第三方事件读取端默认拒绝，且属上游未开放面）。
17. **（v0.5）业务存储分层**：低量实体（krm 二表/技能元数据/工作区扩展/模板）走 `ctx.storage` 的 `defineDomain` 机制；高增长实体（cronExecutions）第一天进插件自有 `node:sqlite` 库，不碰上游库。
18. **（v0.5）cron 无人值守执行会话显式钉 `sandbox/mode = workspace-write` + `approval/policy = never`**：两 knob 经 canonical setter 直设（落在 `custom` 预设态，**非**默认 `workspace-write` 预设——该预设捆绑 `ask`），沙箱内自主执行、越权自动拒绝（fail-closed）并落执行记录；明确「never 拒绝一切需审批操作（含只读需审批项）」的取舍；避开 `danger-full-access` 预设。
19. **（v0.5）cron 调度自建**：引入 cron-parser 类成熟库解析表达式与计算下次触发（含时区），`cordis-plugin-timer` 仅作毫秒 interval/timeout 底层载体；「最小粒度 5 分钟」为产品约定而非上游机制。
20. **（v0.5）业务 RPC 承载优先评估 `connection.rpc.handle('/ext', ...)`**：继承官方信任栅栏（Host/Sec-Fetch-Site/Origin 校验）与统一信封；P0 spike 验证，不可行则退回 `webServer.register` 裸路由并复刻三项检查。
21. **（v0.5）品牌版默认使用独立 `DSH_HOME`**（`%APPDATA%/<brand-id>/dsh-home`），共享 `~/.dsh` 降级为显式 opt-in；解决品牌间数据隔离与「卸载干净」矛盾。
22. **（v0.5）P3 拆分**：P3a = capability-krm（规则/记忆，注入链风险最高，独立验收 S4）；P3b = capability-skillx。
23. **（v0.6）中英双语（zh/en）**：官方组件（会话/设置等）随官方 `locale` 偏好自动切换（上游已内置 zh/en 双语框架 + 设置页 Language 行）；bc 自研外壳/页面经 `ctx.locale.register(ns, { zh, en })` 注册自身文案命名空间、渲染走 `t`（Translate）标准 seat；zh 为 key 集事实源、en 编译期校验双语平衡；用户内容（会话/记忆/规则正文）不做机器翻译，保持用户原文。
24. **（v0.7）去「库」**：单机版就是本地文件操作，跨会话文件归集视图多此一举——本期不做，完成后另做方案（用户决策）。
25. **（v0.7）去「知识库」**：上传/录入类知识库价值有限——本期不做，基础版完成后单独规划（用户决策）。
26. **（v0.8）工作区必须手动选择**：不自动创建任何默认工作区（工作文件不落 C 盘/AppData，规避数据风险）；首次启动强制走原生文件夹选择框，选定目录后才可进入会话；无工作区时应用不可用（用户决策）。

## 变更记录

- v0.9.1（2026-08-28）：**归档收口**——01–05 五篇规划正文冻结归档至 [spec-v0.8-archive/](spec-v0.8-archive/README.md)（正文不改写，勘误外置归档 README）；本 README 收口为现役唯一入口；对照表刷新（cron 引擎/技能校验已落地、补 file-open 包、结构对照改 3 包、下一步基线更新）；配套材料表路径统一 `reference/` 写法；TencentDB-Agent-Memory 标注未入镜像；新增「AI 开发规范正典 = `.claude/`」说明。
- v0.9（2026-08-19）：新增「现状与规划对照」节（代码事实基线，HEAD d13d8b2；含功能/结构/下一步基线三张表）；新增 [06-skill-standard.md](06-skill-standard.md)（SKILL.md 编写标准：dsh frontmatter 契约 + skill-creator 写法 + bc 应用字段）；任务看板刷新实际状态并拆解 P3a/P4（另见任务看板 v0.9 说明）。
- v0.8（2026-08-18）：工作区改为「必须手动选择」——移除「默认工作区」自动种子（不再创建 `$DSH_HOME/workspaces/default/`，工作文件不落 C 盘）；首次启动强制走原生文件夹选择框，无工作区则不可进入会话；删除 workspaceExt.isDefault 字段；「自由任务」兜底措辞改为「会话必须显式选工作区」。
- v0.7（2026-08-18）：人工审核后调整。去「库」（跨会话文件归集后置另做方案，删 capability-library / libraryIndex / F5 / R15/R6 及库相关路由）；去「知识库」（后置单独规划，删 knowledgeEntries / F6 / R16/R5 及知识相关注入段）；明确默认工作区路径与原生文件夹选择主交互；补上游未来若内置记忆的应对（R23）；功能重编号 F1–F10、§3/§4/§6 节号与交叉引用同步更新。
- v0.6（2026-08-18）：新增中英双语（zh/en）需求。核对上游 `packages/client/locale/` 已内置完整双语框架（`ctx.locale` 注册表 + `t` seat + 设置 Language 行 + 持久化 `locale.preference`）；官方组件零成本双语，bc 自研外壳经 `ctx.locale.register(ns, { zh, en })` 落地；branding.yaml 文案字典改按语言分键；新增多语言规格（F10）、D14 决策、C10 约束、S10 冒烟、R22 风险；frontend-user 中文硬编码文案纳入 P2 抽取。
- v0.5（2026-08-18）：吸收三方评审（deepseek/GLM/kimi）。核心修订：工作区切上游官方域（删两表）、删除=archiveSession、注入落日志改官方 `request/header` 快照、R11 关闭、无人值守权限落规格（workspace-write + never）、cron 自建解析（timer 无 cron）、存储分层（执行记录/库索引进自有 sqlite）、`/ext` 承载评估 `connection.rpc.handle`、P3 拆分、技能七层口径与 `/name` 词边界语义、库扫描忽略规则、知识正文落盘两难定验证项、cron 时序（create→selectModel→prompt）与并发策略、品牌独立 DSH_HOME、升级演练补旧会话日志回归与 storage 版本演练、风险清单扩至 R21、文档勘误（三处 preset/企业级残留、document-per-key 表述、§4.5 缺号等）。
- v0.4（2026-08-17）：工作区简化为官方一致「选项目目录」（砍三段企业定制与 preset 生成，归多用户期）；技能两 tab（市场+已安装）+ 全局/项目安装位置 + `.agents/skills` 目录模型（上游原生支持已源码验证）；cron 必选工作区、去技能配置；注入顺序去 preset 段；新增 S2b 冒烟、R11 补充证据。
- v0.3（2026-08-17）：新增白标品牌配置机制（`branding/` 单一事实源 + 固定代码标识符规则 + S7 白标冒烟 + R12 风险）。
- v0.2（2026-08-17）：「工作事项」→「工作区」（对齐官方 workspace）；砍「自由任务」（默认工作区兜底）；绑定状态机简化为创建时绑定；库简化为工作区目录扫描 + 附件索引；新增 R11（工作区接缝验证）与 P0 spike ④。
- v0.1（2026-08-17）：初稿。
