# 05 参考内容与调研存档

- 版本：v0.8-draft（2026-08-18）
- 上级文档：[README.md](README.md)
- 本文是评审的交叉验证材料：外部材料索引、概念映射、三份调研的结论存档（压缩版，原文见对话记录/源码）。
- v0.5 说明：经三方评审（deepseek/GLM/kimi）源码级核查后修订——工作区/导出/存储/timer/权限等事实已更正，勘误处以「（v0.5 修正）」标注。

## 1. 外部材料索引

| 材料 | 路径 | 用途 |
|---|---|---|
| 多用户架构 v0.8.1 | `demo/docs/BC Agent 系统架构设计方案 v0.8.1.md` | 领域模型/交互设计权威参考 |
| 自研前端 | `demo/frontend-user/`（关键：`src/components/*.tsx`、`src/globals.css`） | UI 移植来源 |
| dsh 架构文档 | `docs/architecture.md`、`docs/cookbook/`、`docs/cordis-primer.md` | 上游机制权威来源 |
| bundle/profile 机制 | `packages/bundle/base|web-app/cordis.patch.yml`、`packages/bundle/*/README.md` | patch 叠加语法 |
| web 服务器接缝 | `packages/host/webserver/README.md` | 路由/WS/fallback/tapIndex |
| /api 网关 | `packages/host/apiproxy/README.md`、`packages/client/connection/README.md` | RPC 域/线协议/信任栅栏 |
| workspace 域 | `packages/workspace/workspace/`（README/spec/entity）、`packages/host/apiproxy/src/api/workspace.ts` | **v0.5 起为本方案工作区唯一事实源** |
| 权限与审批 | `packages/interaction/permission-presets/README.md`、`packages/interaction/user-approval/README.md` | 无人值守权限接缝 |
| system-prompt 注册表 | `packages/core/system-prompt/README.md` | section/context/variable/waterfall |
| 多语言/locale | `packages/client/locale/`（README、`src/client/index.ts`、`src/locales/`） | **v0.6 起双语（zh/en）唯一事实源** |
| slot 系统与客户端插件规范 | `packages/client/AGENTS.md` | UI 插件唯一组合 API |
| 皮肤示例 | `demo/skin-plugin/`（`package.json`/`src/index.ts`/`src/client.ts`/`build.mjs`/`cordis.patch.yml`） | 最小 UI 插件教材 |
| 前端 dist 替换机制 | `packages/host/frontend-static/README.md`、`apps/web/package.json` | 备选路线 D1① |
| 存储 | `packages/storage/storage/README.md`、`packages/storage/storage-sqlite/README.md`、`packages/storage/storage-domain/`（`defineDomain`） | ctx.storage 契约 |
| 会话持久化 | `packages/session/session-persistence*/README.md` | 事件日志/两后端 |
| 会话搜索 | `packages/session-query/session-query-sqlite/README.md` | FTS5（默认关闭） |
| 调度/作业 | `packages/schedule/schedule/README.md`、`packages/jobs/jobs/README.md`、`vendor/timer/README.md` | session 级提醒 vs 进程内作业 vs 毫秒定时器 |
| 桌面参考 | `demo/deepseek-harness-desktop/dsh-plugin-desktop/`（`README.md`、`src/client/advanced-shell.ts`、`cordis.patch.yml`、`docs/plugin-services.md`） | 架构纪律 + 高级模式验证 |
| TAM | `demo/TencentDB-Agent-Memory/`（`MemoryCore/README_CN.md`、`tdai-gateway.standalone.yaml`、`openclaw-plugin/README.md`、`INSTALL.md` dsh 章节） | 记忆引擎评估 |
| 三方评审报告 | `deepseek评审/评审报告.md`、`GLM评审问题/评审报告-2026-08-18.md`（+事实核查）、`kimi评审/评审报告-v0.4.md`（+事实核查附录） | v0.5 修订依据 |

## 2. 概念映射表：v0.8.1（AgentScope 栈）→ BC Agent Desktop（dsh 栈）

| v0.8.1 概念 | 原实现 | 本方案等价物 |
|---|---|---|
| AgentScope `Agent` 类 + `reply_stream()` | Python agent 引擎 | dsh `agent-loop` + session.prompt RPC |
| 放弃 `create_app`（避免双 Service 争夺资源） | 自建 FastAPI 路由 | 同一哲学：用 dsh 插件而非 fork；dsh 官方 UI 与我们的 UI 不共管会话状态（/api 为唯一事实源） |
| `conversations`/`messages` PG 表 | 自建 | dsh session 持久化（jsonl/SQLite，append-only 事件） |
| `conversations.project_id = NULL`（自由会话） | PG | 不实现（v0.8）：会话必须显式选工作区；纯聊天走官网 |
| `agent_state` JSONB 快照 + messages 重建 | 两条恢复路径 | 上游自带（事件日志重放），不自建 |
| AgentState 同事务写入 | PG 事务 | 上游持久化内部机制，不干预 |
| SKILL.md + `skill_config` | LocalSkillLoader/SubAgentTemplate | 上游 skill 目录原生发现（全局 `~/.dsh/skills`、`~/.agents/skills` + 项目级 `.agents/skills`、`.dsh/skills`，随 cwd 自动生效）；`skill_config`（inline/fork 执行模式、工具白名单）归多用户期 |
| 工作事项（projects 表：三段定义/分配/审核） | PG 表 + service | **v0.5：上游 workspaceRegistry（目录注册 + 会话分组 + 归档）+ bc 薄层（首次启动强制选工作区/预留字段）**；三段定义归多用户期 |
| `project_conversations` 绑定表 | PG | **v0.5：无自建表**——`session.create({ workspaceId })` 创建即归组，绑定语义 = cwd 不可变 |
| Mem0 + 四类型分类双层 | Mem0Middleware + 自建分类 | 自建四类型（§3.8），无向量层 |
| MEMORY.md 动态生成 | MemoryService 拼接 | capability-krm 索引段注入（同设计） |
| MemoryFreshnessTracker | PG 元数据回查 | 同设计，updatedAt 基准 |
| `permission_rules`（deny/allow glob） | AgentScope PermissionContext | dsh 权限/审批体系（官方），不自建 |
| 权限模式五档 | PermissionMode | dsh permission-presets（`sandbox/mode` + `approval/policy` 捆绑；cron 无人值守 = workspace-write + never，v0.5 已确认） |
| 三明治权限 | 白名单→规则→运行时 | 上游等价物 + 我们不自建 |
| APScheduler（cron + timezone） | Python | **cron-parser 自建调度 + cordis-plugin-timer 载体**（v0.5：timer 无 cron 能力，上游亦无系统级 cron） |
| MinIO 文件 + 预签名 URL | 对象存储 | 上游 attachment（仅图片）/deliverables 本地存储（**库后置另做方案**，v0.7） |
| ProjectAwareWorkspaceManager | 按 project 隔离工作区 | v0.2 对齐 dsh workspace；**v0.5 上游 workspaceRegistry 即隔离边界**（canonical path 唯一 + 会话 cwd 归组） |
| `llm_call_logs` | PG 表 | 上游 session 事件/遥测承载；不自建 |
| JWT/authserver、users/departments/positions | 组织层 | 无（单用户） |
| 管理平台 frontend-admin | Ant Design Pro | 无；管理功能并入设置页 |
| 子 Agent 模板 sub_agent_templates | `.agents/*.md` | dsh subagent 能力（上游），不自建 |
| 上下文压缩（L0-L4） | ContextCompactMiddleware | dsh compaction 插件（上游） |

## 3. TencentDB-Agent-Memory 评估存档（结论：不直接引入，三方评审一致）

### 3.1 项目事实

- 组成：MemoryCore（HTTP Gateway :8420，记忆管线）、MemoryKnowledge（wiki/code-graph 检索 + 唯一的 MCP server）、MemoryPanel（Web 管控台）、MemoryProxy（LLM 流量透明代理，含 dsh 适配器）
- 记忆模型：L0 原始对话（JSONL+SQLite 向量）→ L1 原子记忆（LLM 抽取+dedup）→ L2 场景记忆（LLM 聚合）→ L3 用户画像；另有 Skill Memory（任务 SOP 提炼）
- 管线参数：每 5 轮对话或空闲 600s 触发 L1 抽取；L1 后 90s 触发 L2；每 50 条 L1 触发 L3 —— 全程消耗 LLM token
- 检索：keyword(BM25)/embedding/hybrid(RRF)，默认 BM25（embedding provider 默认 none）
- 技术栈：TypeScript/Node ESM ≥22.16；SQLite 默认后端（`sqlite-vec 0.1.7-alpha.2` 向量 + FTS5）；TCVDB/Mongo/Redis/COS/ClickHouse/Kafka 全部 opt-in 关闭
- 联网：仅强依赖一个 OpenAI 兼容 LLM API（可指 DeepSeek）；不依赖腾讯云（"TencentDB"是品牌名）
- License：MIT；成熟度：2026-08 首发 beta，CI 无测试步骤，v2→v3 数据格式刚迁移

### 3.2 集成方式评估

| 方式 | 结论 |
|---|---|
| MCP 接入 | **不通**。MCP server 只在 MemoryKnowledge（12 个 code-graph/wiki 查询工具）；记忆能力明确不暴露 MCP（"management operations are NOT exposed as MCP tools"）；且 MCP 协议无 prompt 构造 hook、无 agent_end hook，承载不了「自动 capture + 注入 + 后台管线」 |
| MemoryProxy 透明代理 | 不采用。为团队多租户设计：双进程（Core+Proxy）、默认 Redis、每会话 team/agent/task 三元组选择器、强制鉴权头——单用户过重 |
| MemoryCore sidecar + 自写 dsh 插件 | 技术可行（openclaw-plugin 是官方 adapter 模板：agent_end→写 L0、before_prompt_build→注入 L1/L3、注册检索工具），但打包/运行成本高（§3.1），记忆哲学不匹配（§3.3） |

### 3.3 不匹配论证（核心）

TAM = 「自动管线」：记忆由 LLM 从对话自动抽取归纳，用户被动接受。
BC Agent 前端 + v0.8.1 §6 = 「用户主导」：四类型手工管理、feedback 强制 Why/How to apply、新鲜度警告、不该记清单。
直接引入 TAM 的三种结局：a) 废掉已完成的记忆 UI 与 v0.8.1 设计；b) TAM 退化为纯存储/检索层（价值仅剩混合检索，单用户量级用不到）；c) 两套记忆并存（成本最高的复杂度）。

### 3.4 保留价值

1. L1 dedup（相似度去重）思想可借鉴进自建版——**时点：P5 后「自动记忆沉淀」启动时**（低成本方案：标题/正文归一化 + 编辑距离阈值，不引向量）
2. MemoryKnowledge（code-graph/wiki MCP）→ 待知识库单独规划时评估，走 dsh mcp-client 挂载（这是 MCP 的正确位置）
3. 若未来做「自动记忆沉淀」侧能力，重新评估 TAM sidecar 与手动记忆并存方案

## 4. 上游能力调研存档（v0.5 修订版）

### 4.1 /api 网关（前端唯一官方通道）

- HTTP POST 一元调用 + 两个下行 WS（`/api/events.mux`/`/api/events.host`，只收不发；GET 返回 426，无 SSE fallback）
- 线协议四象限：ClientRequest/ServerResponse/ServerRequest/ClientResponse（respond 用于 user-question 应答）
- RPC 域：`session.*`（history/list/create/fork/models/selectModel/prompt/cancel/updateQueue/rename/search/attachment）、`subagent.prompt`、`workspace.*`（list/create/rename/delete/insertBefore/insertSessionBefore/archiveSession）、`host.*`（status/pickDirectory/listDirectory/createDirectory/openPath/describe）、`agentPreset.*`（list/select/read/copy/openDocument/remove）、`command.*`、`skill.list`（调用走 session.prompt 的 `/name`）、`settings.*`、`credentials.*`、`llm.*`、jobs 快照、projections、转发事件
- **`session.export`（v0.5 修正）**：不是 RPC 方法——GET 下载路由（`fetch/handler.ts`），返回会话日志 ZIP（含可选子代理后代），无 wire 信封；前端以链接下载方式调用
- **`session.create` 入参（v0.5 确认）**：`{ workspaceId?, cwd?, sessionId?, agentPreset? }`，workspaceId/cwd 互斥（schema refine）；传 workspaceId 即以工作区目录为 cwd 并 attach 归组；**无 modelId/title 入参**——模型默认来自 Host `ctx.agentDefaultModel`，需经 `session.selectModel` 切换
- 信任栅栏：Host 头 loopback/trustedHosts 校验（防 DNS rebinding）+ `sec-fetch-site: cross-site` 拒绝 + Origin 一致性检查；特权方法仅 loopback；POST 强制 `application/json`（防 CSRF 盲调）；`--host 0.0.0.0` 官方不支持（无认证层前）。**栅栏作用域 = `/api` 前缀与其 WS 升级路由，不覆盖插件经 `webServer.register` 注册的路由**（"Knows no harness concepts"）
- **RPC 通道扩展点（v0.5 新记录）**：`ctx.connection.rpc` 提供 `intercept('/api', ...)`（座位已被 Typert 网关占用，每通道仅一个拦截器）与 `handle(channel, ...)`（注册全新通道，**自动继承上述栅栏与 POST+JSON 强制**）——本方案 `/ext` 通道的首选承载（D3'）
- **无协议版本字段**：client/host 一起发布；独立客户端出现前不做版本协商

### 4.2 前端扩展四路径

1. patch `web-runtime.distIndex` 完全替换 dist（frontend-static 单兜底座位，SPA 语义：miss 回 index 200、穿越 403）
2. `ctx.webServer.register(prefix/exact)` 自建静态资源/路由（**无 body 解析/multipart 支持，插件自行实现**）
3. `registerUpgrade` 自建 WS（`/api/events.*` 已被占用）
4. `tapIndex` 改 index.html + `dsh.client` 浏览器插件（slot 或 DOM 注入）

### 4.3 slot 系统

- 唯一 API：`ctx.slots.register({ name, children?, store?, inject? }, Component)`；shell 只渲染 `root`
- **子 slot 名（v0.5 补）**：`sidebar/conversation/details/shell.overlay` 这 4 个名字是官方 ui-layout 的 root 注册所声明（children 类型上可声明任何 SlotMap key）；**占 root 者必须自己重新声明所需子 slot，否则官方组件注册会抛 "slot is not declared"**；dispose 级联塌缩子声明
- 桌面参考项目高级模式实证：禁用官方 `ui-layout` 行 → 自家插件注册 `root`（children: sidebar/conversation/details/shell.overlay）→ 官方组件仍注册到子 slot 被复用
- 三层架构：数据对象层（runtime，React-free）→ 渲染机制层（web-react shell）→ 表现组件层（插件，纯 props）
- `dsh.client` manifest：`platform: 'web'` 必填；激活顺序由 cordis fiber inject 驱动而非 manifest 顺序

### 4.4 存储机制（v0.5 修订；原 §4.4/§4.6 编号合并）

三处 SQLite（全部 node:sqlite，仅当前 SCHEMA_VERSION 可开、无迁移）：

1. `storage-sqlite`：域 KV（**document-per-row**），第三方复用入口 `ctx.storage.domain`；上游 workspace 域示范的建模姿势是 `defineDomain({name, version, global, tables})`（版本化 domain + 两阶段写）
2. `session-persistence-sqlite`：事件日志（上游私有，勿复用）
3. `session-query-sqlite`：FTS5 派生索引（web profile 默认 `:memory:`+`openAt: never` 关闭；开启需 patch 且禁指向持久化库）

**json 后端（web 组合默认）事实（v0.5 修正）**：每 domain 一个 JSON 文件、**整域序列化重写**（非 document-per-key）；KvTable API（get/put/delete/update/entries/keys/size）为内存全表快照迭代，**无前缀枚举**——高增长实体不适合（D4 分层依据）。

### 4.5 调度事实（v0.5 修订）

- `packages/schedule`：session 级提醒，三工具（create/list/delete），支持 after_seconds/at/every_seconds（≥5 分钟），无 cron 表达式，冷 session 无通知（resume 后处理 overdue，仅最新一次 catch-up）；**不在默认 web 组合**（仅 `examples/web-schedule` overlay 开启）
- `packages/jobs`：进程内后台作业注册表（run_in_background 类），无跨进程持久化
- `cordis-plugin-timer`（vendored，`vendor/timer/`）：**仅 `ctx.timeout/interval/throttle/debounce`（毫秒 delay 包装），无 cron、无 timezone**（v0.5 事实修正——v0.4 曾隐含其可按 cron 驱动）；base 已挂载，可作进程内毫秒载体

### 4.6 权限与无人值守事实（v0.5 新增）

- permission-presets：捆绑 `sandbox/mode` + `approval/policy` 两个旋钮；出厂预设 `workspace-write`（+ask）与 `danger-full-access`（+never）；**预设与会话创建时 pin**，之后改全局设置不影响既有会话；`set(session, name)` 可按会话切换
- `ApprovalPolicy = 'ask' | 'never'`；`'never'` = 不询问任何人、每个审批请求自动 resolve 为 `'rejected'`（**fail-closed**），会话日志留 `approval/asked → approval/decided` 记录；headless/未完整组装时 answerer 解析为 `unavailable` 同样 fail closed
- web 组合默认经 `DSH_PERMISSION_MODE` 环境变量接线，默认 `workspace-write` + `ask`
- 结论：cron 无人值守落点 = 显式钉 `workspace-write` + `never`；**无「只读放行」分级**（never 拒绝一切需审批操作）

### 4.7 技能目录发现机制（已验证，源码级）

证据：`packages/skill/skill-filesystem/src/index.ts`（roots 构造 L241-261、rank 常量 L36-43、findProjectRoot L937-947、discoverRoot L719-747）、`packages/skill/skill/src/index.ts`（rank 比较 L807-811、跨层 overlay L552-566）、`packages/host/apiproxy/src/api-proxy.ts`（skill.list handler L3210-3257）。

- 发现根与 rank：`<项目根>/.dsh/skills`(100) < `<项目根>/.agents/skills`(200) < runtime(250) < custom(300) < `~/.dsh/skills`(400) < `~/.agents/skills`(500) < bundled(600)；rank 低者胜
- 项目根判定：从 cwd 向上最近 `.git` 祖先，无则回退 cwd 本身
- 触发条件：项目级根仅在 lookup `cwd !== undefined` 时扫描；会话技能经 `tool-skill` 自动传 `agent.session.header.cwd` → **项目技能随会话 cwd 自动生效，无需挂载**
- 同名覆盖：同 layer 内按 rank；跨 layer 近层完全覆盖远层（scope overlay，非 rank）
- 扫描格式：每根仅一层——`<root>/<name>/SKILL.md` 或 `<root>/<name>.md`；嵌套 `**/SKILL.md` 不发现（→ `skills-disabled/` 必须放**扫描根同级**）
- watcher：Chokidar + fs.watchFile，文件变更自动失效并触发 `skills/change`；项目 watcher LRU 上限 128
- `skill.list` RPC：入参 sessionId（handler 取 `session.header.cwd`），返回扁平 `{name, description, whenToUse?, modelInvocable}`，**显式丢弃 source/provider/rank**（"provider/source vocabulary stays host-side"）→ 前端按层级分类需自扫目录
- **`/name` 手势语义（v0.5 补）**：上游正则 `(^|\s)\/([a-z0-9-]+)(?=\s|$)` 扫描用户消息**全部 text block**——词边界 token、可在任意位置（非仅前缀）；仅 `source.kind === 'user'` 消息触发
- 上游近似「停用」机制：frontmatter `disable-model-invocation` / `user-invocable: false`（语义是隐藏调用面，非停用；不与移动目录机制混用）

### 4.8 桌面参考项目关键纪律（自建壳照抄清单）

- webserver 强制 `127.0.0.1:0`（launcher 安全不变量，非用户配置）
- 同源导航校验 + 外链转系统浏览器 + contextIsolation + sandbox + 无 preload bridge
- 打包运行时放 `app.asar.unpacked`（物理路径）；pnpm/node/dsh 私有 shim 全在 `userData`，不动系统 PATH/shell rc
- `ELECTRON_RUN_AS_NODE` 复用 Electron 二进制跑 Node 子进程，import dsh 前清除该变量防泄漏
- renderer boot 上报路由：Loader 启动健康失败时弹原生对话框引导修复（比白屏好）
- profile 切换：dispose 整个 Cordis generation + relaunch，绝不热切换
- 一个 generation 同时只允许一个 pnpm 包操作（串行 gate）
- Windows 打包解法（独立 repo 必须照抄）：`npmRebuild=false` + node-pty prebuilds 校验 + asar.unpacked 清单 + **上游 workspace 的 pnpm patch（node-pty asar 适配）需在自有 `pnpm-workspace.yaml` 复制同款 `patchedDependencies`**

### 4.9 Windows 事实（v0.5 新增）

- shell 栈：base 按平台切换，win32 默认 pwsh 栈（bash 行禁用）；pwsh 解析链 = PS7 安装位置 → PATH → **Windows PowerShell 5.1 兜底** → 裸 pwsh；**仅 5.1 时非 ASCII stdin 可能误解码**（中文产品高频风险，R17）
- 沙箱：Windows 为 ACL 受限令牌 runner，**保证级别 partial**（Everyone 写边界、NTFS 硬链接逃逸、部分 CIM cmdlet 不可用）；landlock Linux-only（win32 明确不支持、fail closed）
- Electron + ACL runner 已知坑（上游 Agent Note 2026-08-15）：`process.execPath` 需 `ELECTRON_RUN_AS_NODE` trampoline、控制台窗口闪烁
- 上游 CI 有原生 Windows 完整门禁（`windows-native` job）——Windows-first 的成熟度有 CI 背书

### 4.10 多语言/locale 事实（v0.6 新增）

- `@deepseek-ai/dsh-client-locale` 提供 `ctx.locale`（`LocaleRuntime`）：`register(ns, { zh, en })`（typed，**编译期强制双语平衡**——每个 shipped locale 必填、缺/多 key 编译报错）、`bind(ns)` → typed `Translate`/`TranslateNS`、`setLocale(id)`（唯一写入口）、`getLocale()/getSnapshot()/subscribe()`（LocaleFace，经 `ctx.slots.installLocale` 装为渲染机制合成的 `t` 标准 seat）
- shipped locales：`[{ id: 'zh', label: '中文' }, { id: 'en', label: 'English' }]`；`FALLBACK_LOCALE = 'zh'`；查找链「当前语言 → zh 回退 → common → key 原文」（缺词 fail-loud 显示 key，非空白）
- 持久化偏好：settings namespace `locale`、field `preference`；缺省时按浏览器语言（`detectBrowserLocale`，主 subtag 匹配 zh/en）
- 设置入口：locale 插件在官方 `settings.general.item` slot 注册 Language 行（id `language`）——官方设置 General 页已带语言切换
- 结论：**官方组件（conversation/settings 等）双语零成本**；bc 自研外壳/页面只需注册自身命名空间即可（D14/F10）

## 5. 已知上游未覆盖项核对（v0.5 修订，与 01-background §2.2 一致）

| 项 | 上游状态 | 本方案落点 |
|---|---|---|
| 规则 / 记忆 | 无内置（记忆走外部 MCP 的 stance） | capability-krm（04-spec §3.5-3.6）；**知识库后置单独规划（v0.7）** |
| 系统 cron | 无（schedule 是 session 级提醒且不在默认组合；timer 无 cron） | capability-cron 自建解析（04-spec §3.4） |
| 工作区注册表本体 | **有**（`workspace.*` + workspaceRegistry，v0.5 修正） | 复用官方域；仅首次启动强制选工作区 + 扩展元数据自建（04-spec §3.2） |
| 库（跨会话文件归集视图） | 无（attachment 仅图片；deliverables 无归集视图） | **后置另做方案（v0.7）** |
| 技能管理流（上传/安装/状态） | 无（仅目录发现） | capability-skillx（04-spec §3.3） |
| 业务数据备份/导出 | 无 | capability-core export/import（04-spec §5） |
