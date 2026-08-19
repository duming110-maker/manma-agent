# 01 背景

- 版本：v0.8-draft（2026-08-18）
- 上级文档：[README.md](README.md)

## 1. 项目缘起

用户为金融信贷场景（催收/风控/贷后/房产核值）规划了一套企业级 AI Agent 平台「BC Agent」，已有：

- 一份经三轮评审的多用户架构设计（v0.8.1，原技术栈 AgentScope 2.0 + FastAPI + PostgreSQL）
- 一个按该设计完成的用户端前端（`demo/frontend-user`，全部功能 UI 已实现，数据为 mock）

在推进过程中，决策发生变化：

1. **AgentScope 2.0 不再使用**。deepseek-harness（dsh）已经是一个成熟的插件化 agent harness（会话、技能、工具、权限、子代理、压缩、Web UI、RPC 网关俱全），自建 Agent 引擎层没有必要。v0.8.1 的价值从「技术方案」降级为「领域模型与交互设计参考」。
2. **多用户版暂缓**。当前没有实际的多用户需求，服务器与部署成本高。策略改为：先做**单用户桌面版并开源**，待企业出现定制需求再演进多用户。
3. **前端界面自研**。dsh 官方前端与 `demo/deepseek-harness-desktop` 桌面版的界面、展示方式、文件夹组织被认为不理想，不采用；但后者的**架构思路**（插件化桌面壳、npm 依赖上游、loopback 通信）被认可，作为主要参考。

## 2. 现有资产盘点

### 2.1 自研前端 `demo/frontend-user`

| 维度 | 事实 |
|---|---|
| 技术栈 | React 19 + Vite 6 + TypeScript strict + Tailwind CSS v4（CSS-first）+ shadcn 风格组件 + react-router-dom 7 |
| 形态 | 纯 Web SPA，无桌面壳、无后端通信层、无持久化（仅主题存 localStorage） |
| 完成度 | 计划的 9 项功能 UI 全部完成（技能/定时任务/库/工作事项/普通任务/色调/知识库/规则/记忆），全部 mock 数据；**其中库/知识库页面本期不移植（后置，v0.7）** |
| 设计语言 | 对齐 manus.im/app：侧栏 300px（折叠 60px）、暖灰色系、亮/暗双主题（CSS 变量 + `.dark` 类切换） |
| 已知缺陷 | ① 缺 `src/lib/utils.ts`（cn 函数），当前无法构建；② `.next/` 迁移残留未清理；③ 无测试/lint；④ UI 文案硬编码中文、无 i18n（v0.6 需在 P2 抽取为 locale 字典） |
| 关键文件 | `src/components/Sidebar.tsx`（工作事项/任务分组）、`ConversationPage.tsx`、`SkillsPage.tsx`、`CronPage.tsx`、`LibraryPage.tsx`、`SettingsPage.tsx`（知识库/规则/记忆三 tab）、`globals.css`（主题令牌） |

### 2.2 上游 deepseek-harness（本仓库）

插件化 agent harness，vendored Cordis 架构，「一切皆插件」。与本项目相关的事实：

**已有能力（直接复用，零开发）：**

| 能力 | 位置 |
|---|---|
| 会话持久化（jsonl 默认 / SQLite 可选，append-only 事件日志） | `packages/session/` |
| 会话 RPC（创建/列表/历史/发送/取消/重命名/导出/搜索） | `packages/host/apiproxy/`（`/api` HTTP+WS 网关） |
| 技能系统（`SKILL.md` 目录发现 + `skill.list` RPC + `/name` 调用） | `packages/skill/`。目录模型（已验证 skill-filesystem 源码）：项目级 `<项目根>/.dsh/skills`(rank 100)、`<项目根>/.agents/skills`(200，共享 agents 命名空间)；全局 `~/.dsh/skills`(400)、`~/.agents/skills`(500)。同名项目级覆盖全局；项目技能随会话 cwd 自动生效（`tool-skill` 传 `session.header.cwd`）；watcher 自动刷新；`skill.list` RPC 不暴露来源层级 |
| 设置（`$DSH_HOME/settings.yaml`，namespace + schema，热重载） | `packages/settings/` |
| 凭证（4 级优先级：env > UI 保存 > cwd/.env > ~/.dsh/.env） | `packages/credentials/` |
| LLM 提供方（DeepSeek 适配、模型发现） | `packages/llm/` |
| 工具体系（bash/fs/web/todo/subagent/workflow…）、权限与审批 | `packages/*/tool-*`、`packages/interaction/` |
| Agent preset（每会话 agent 组合，cordis.yml 定义） | `packages/preset/` |
| Web 服务器（HTTP 路由/WS upgrade/静态兜底/index 变换，全部可被插件注册） | `packages/host/webserver/` |
| Web 前端（React 18.3 客户端运行时 + slot 系统 + 约 20 个 ui-* 插件） | `apps/web/`、`packages/client/` |
| 存储 KV 抽象（json/sqlite 后端可切，`ctx.storage.domain` + `defineDomain` 版本化 domain 机制） | `packages/storage/` |
| **工作区注册表**（durable 目录记录 + canonical path 唯一 + 会话分组账户 + 全局归档集 + 持久排序；`workspace.*` RPC 7 方法；`session.create({workspaceId})` 创建即归组） | `packages/workspace/workspace/`、`packages/host/apiproxy/src/api/workspace.ts`（v0.5 修正：v0.4 曾误判为需自建） |
| 权限预设（`sandbox/mode` + `approval/policy` 捆绑，会话级 pin；`ApprovalPolicy = 'ask' \| 'never'`，`never` fail-closed 自动拒绝） | `packages/interaction/permission-presets/`、`packages/interaction/user-approval/` |
| **中英双语框架（zh/en）**（`ctx.locale` 注册表 + `t`（Translate）标准 seat + 设置页 Language 行 + 持久化 `locale.preference`；`register(ns, { zh, en })` 编译期强制双语平衡；zh 为 fallback） | `packages/client/locale/`（v0.6 复用） |
| RPC 通道扩展点（`connection.rpc.handle` 注册新通道自动继承官方信任栅栏；`intercept('/api')` 座位已被 Typert 网关占用，每通道仅一个拦截器） | `packages/client/connection/src/rpc.ts` |
| 定时器插件（`cordis-plugin-timer`，base 已挂载；**仅毫秒 timeout/interval/throttle/debounce，无 cron**） | 上游依赖 |
| 后台作业注册表（进程内） | `packages/jobs/` |
| 会话全文搜索（SQLite FTS5，web profile 默认关闭） | `packages/session-query/` |

**没有的能力（需自建插件）：**

| 缺口 | 说明 |
|---|---|
| 知识库 | 无内置（仅 examples/mcp-memory 演示外接 MCP 记忆服务）。**v0.7 用户决策：后置单独规划，本期不做** |
| 规则管理（行为规则注入） | 无内置（权限规则有，但用户自定义「行为/风格规则」无） |
| 记忆 | 无内置。上游 stance：不托管记忆服务，走外部 MCP |
| 系统级 cron | `packages/schedule/` 仅 session 级提醒（不支持 cron 表达式，session 不活跃不触发，且不在默认 web 组合）；`cordis-plugin-timer` 亦无 cron——表达式解析/下次触发/时区需自建（引 cron-parser 类库） |
| 工作区的「首次启动强制选工作区」与业务扩展元数据 | 上游 workspaceRegistry 提供注册表本体（v0.5 起复用为唯一事实源），但无首次启动强制选工作区流程、无业务预留字段（status/ownerId）——仅此薄层需自建 |
| 库（AI 产出文件归集） | 会话附件/deliverables 存在，但无跨会话归集视图（attachment 目前**仅支持图片**，非通用文件附件）。**v0.7 用户决策：后置另做方案，本期不做** |
| 技能企业流（上传/安装/状态管理） | 技能目录发现有了，管理流无 |

**前端扩展机制（本方案的基石）：**

- 前端静态资源：`web-runtime` 行的 `distIndex` 指向官方前端包 dist，可通过 patch 覆盖（完全替换路线，本方案不采用为主路线）
- **slot 系统（本方案主路线）**：客户端插件通过 `ctx.slots.register({ name, children }, Component)` 注册 React 组件；shell 只渲染 `root` slot；`root` 可声明 `sidebar/conversation/details/shell.overlay` 子 slot。桌面参考项目的「高级模式」已验证：禁用官方 `ui-layout` 行后由自己的插件占 `root` slot 提供完整外壳，同时官方 sidebar/conversation/details 作为子 slot 保留
- Host 侧：插件可用 `ctx.webServer.register()`（HTTP 路由）、`registerUpgrade()`（WS）、`registerFallback()`（静态兜底，单座位）、`tapIndex()`（改 index.html）
- 安装：`dsh plugin --profile <name> add <pkg>`，bundle 通过 `cordis.patch.yml` 叠加；patch 替换整行 config（非深合并）
- 教学示例：`demo/skin-plugin/`（最小 UI 插件：node 半注册路由 + 浏览器半 DOM 注入 + build.mjs 打包约定）

### 2.3 桌面化参考项目 `demo/deepseek-harness-desktop`

第三方开源的 dsh 桌面壳（Electron 43 + electron-builder）。**只借鉴架构，不 fork**（它带 profile 多套管理、社区市场 RFC、Windows ACL patch 等大量与本项目无关的复杂度；且其界面被用户否定）。

值得借鉴的点：

1. **桌面壳本身是一个标准 Cordis 插件**，通过 `cordis.patch.yml` 在 `dsh-web-app` 之后插入 desktop 层，无特权、不 fork 上游
2. **上游全部走 npm 依赖**（锁定 `@deepseek-ai/dsh-*` 版本）；`upstream.json` 记录已验证的版本
3. **loopback HTTP+WS 复用官方前端**，不造 Electron IPC；webserver 强制 `127.0.0.1:0`；`contextIsolation` + sandbox + 外链转系统浏览器
4. 打包 pnpm/node 运行时进 `app.asar.unpacked`，私有 shim 放 `userData`，**不污染系统 PATH**
5. profile 切换 = 持久化 pending + 整进程重启 + last-known-good 回滚（不做热切换）
6. 自动更新：轮询版本 API + 下载校验 + NSIS `--updated --force-run` 重装

它的「高级模式」实现（`src/client/advanced-shell.ts`）是本方案 UI 插件的直接技术验证。

### 2.4 多用户架构设计 v0.8.1（领域模型来源）

`demo/docs/BC Agent 系统架构设计方案 v0.8.1.md`，4400 行。技术栈（AgentScope/FastAPI/PG/Redis/Qdrant/MinIO）整体作废，以下内容被本方案继承：

| 继承内容 | 出处 |
|---|---|
| 工作区模型（v0.8.1 称「工作事项」/projects，v0.2 起对齐官方叫法「工作区」；v0.4 简化为选项目目录，三段企业定制归多用户期）：core_duty/work_style/workflow 三段 AI 行为定义 | §13.2 表 #4 |
| 会话-工作区绑定：不可逆、切换=新建会话（v0.2 简化：绑定提前到会话创建时，无「首条消息绑定」中间态） | §12.4 |
| 技能模型：SKILL.md 标准 + 管理元数据分离；inline/fork 执行模式 | §5 |
| 四类型记忆：user/feedback/project/reference；feedback 强制 Why + How to apply；project 相对日期转绝对日期 | §6.2 |
| 记忆索引动态生成（MEMORY.md 非文件，每次会话启动动态拼接 ≤200 行） | §6.3 |
| 记忆新鲜度：以 `updated_at` 为基准（非 last_accessed_at，避免逻辑失效）；超期警告不阻止使用 | §6.4 |
| 「不该记忆的内容」清单 | §6.5 |
| 知识库：仅摘要注入 system prompt，正文按需读取；is_enabled 暂停引用不删除（**v0.7 后置单独规划，本期不继承**） | §13.2 表 #15 |
| 定时任务三表：模板/任务/执行记录；skip_confirm 对应无人值守模式 | §13.2 表 #10/#11 |
| 权限三明治：工具白名单 → deny/allow 规则 → 运行时保护 | §8.1 |
| 技能输入 Chip 交互 + 边界条件表（粘贴不触发/1.5s 自动关闭/多技能） | §5.9 |
| 库模型：files 按 conversation 分组、source=ai_output/user_upload（**v0.7 后置另做方案，本期不继承**） | §13.2 表 #20 |
| LLM 调用日志独立表 | §13.2 表 #12 |
| 设计原则：数据不出本机、渐进式落地 | §1.2 |

砍掉的多用户专属内容：tenants、authserver/JWT、users/departments/positions 表与同步、usage_scope 部门/人员可见范围、审核流状态机（简化为 enabled/disabled）、creator 字段组、管理后台 frontend-admin、Nginx/ELK/SkyWalking/K8s 全套。

### 2.5 TencentDB-Agent-Memory（评估对象）

腾讯开源的 Agent 记忆系统（MIT，2026-08 首发，beta）。评估结论：**不直接引入**，详细论证见 [05-references.md §3](05-references.md) 与 [04-spec.md §10.1](04-spec.md)。要点：

- MemoryCore 是独立 HTTP Gateway（L0 原始对话 → L1 原子记忆 → L2 场景 → L3 画像的 LLM 自动抽取管线），默认 SQLite 本地部署、不依赖腾讯云——这点可行
- 但：需 sidecar 子进程；`sqlite-vec`(alpha)/`@node-rs/jieba` 原生模块需按 Electron ABI 重编译；Node≥22.16；强依赖 LLM API（每 5 轮对话触发抽取，持续 token 成本）；beta 稳定性
- 其「自动管线」记忆哲学与已完成的「用户主导四类型记忆管理 UI」不匹配
- 其 MCP server 只暴露 code-graph/wiki 查询工具，记忆能力不走 MCP，MCP 接入路线不通
- 保留价值：L0-L3 分层归纳思想借鉴；MemoryKnowledge（code-graph/wiki）未来可作知识库增强选项

## 3. 上游稳定性事实（影响所有设计）

dsh 处于 pre-release（AGENTS.md「Pre-release stance」）：

- `/api` RPC **无协议版本字段**，client 与 host 一起发布；官方明言「独立发布的客户端出现时才加版本协商」
- SQLite 后端**仅当前 SCHEMA_VERSION 可开，无迁移**；json 后端（web 组合默认）同样仅当前版本，且是**每 domain 一个 JSON 文件、整域序列化重写**（document-per-row 仅 sqlite 后端成立）
- `SESSION_FORMAT_VERSION = 0`，无兼容承诺——**新版拒绝旧会话日志且无升级路径**（「older: no upgrade path ships yet」），对桌面产品意味着「升级 App 后历史会话可能不可读」，是独立产品风险（见 04-spec R13）
- 第三方自定义会话事件：读取端未知类型默认**拒绝重建**（需 `ignorable: true`，live 写入面不暴露该参数），事件词汇表明示「out-of-repo 插件事件注册面 deferred」——**业务事件不可写入会话日志**（见 04-spec §6）
- 插件契约（`ctx.*` 服务、slot 系统、`dsh.client` manifest）有 README 文档但预发布期可变

结论：本项目**必须锁定上游版本**、把所有上游触点收拢到 adapter 单点、建立升级冒烟清单（含旧会话日志回归与 storage 版本演练）。详见 [03-architecture.md §7](03-architecture.md)。
