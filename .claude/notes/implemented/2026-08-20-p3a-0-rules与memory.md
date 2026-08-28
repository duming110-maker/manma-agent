# 2026-08-20 P3a 规则与记忆（capability-krm，capability-core 内实现）

## 是什么

P3a 全四卡落地（docs/04-spec F5/F6 + §3.5/§3.6/§4.6/§6）：规则 + 记忆的存储、CRUD、注入链路、前端、双语。

1. **存储（P3a-1）**：`packages/capability-core/src/krm.ts` 定义 `bc_krm` 域（`defineDomain`，`rules` / `memories` 两表，zod 持久边界，版本 1），`ctx.storageDomain.open()` 打开。落盘 `$DSH_HOME/storages/bc_krm.json`（unit name+version + 两表）。
   - **域名踩坑**：`UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/` **无连字符**——`bc-krm` 模块加载期直接抛错，改成 `bc_krm`。
   - `enabled` / `freshnessWarningDays` 用 zod `.default()`，旧记录缺字段向前兼容。
   - CRUD 经 `/ext krm.rules.*` / `krm.memories.*`（RPC 端点，沿用现有 `cron.tasks.*` 风格，非 REST）。
2. **注入链路（P3a-2）**（docs/04-spec §6，决策 16）：
   - 规则段 `systemPrompt.section({ name:'bc:rules', order:200, text })`——启用的全局规则拼 `## 行为规则` 段进 system prompt；
   - 记忆索引 `systemPrompt.context({ name:'bc:memories', order:0, text })`——按会话绑定工作区过滤（全局 + 该工作区）拼 `# 记忆索引` 段（名称+类型+描述，超期条目附 §6.4.2 新鲜度警告模板），经 context 贡献为 user-role runtime-context 快照；
   - 作用域判定（V2 验证项）：`AssembleContext.agent.session.header.cwd` → `workspaceRegistry.list()` 反查工作区（精确匹配优先、路径前缀兜底）——**可行性验证通过，无需退 waterfall**；
   - memoize：按（写入版本 + 工作区）缓存渲染结果，避免每 step 重算；任何写操作 `bump()` 递增版本。
3. **前端（P3a-3）**：`RulesMemorySection` 从空态占位改为两 tab CRUD——规则 tab（名称+内容+启用开关，全局）与记忆 tab（四类型/作用域/工作区下拉/新鲜度阈值/feedback 强制 why+howToApply/「不该记忆的内容」提示）。经设置 shell `settings.section` 槽注册，注入与外壳相同的 adapter face（`createUpstreamFace`）。
   - `bc_krm` 记录写入版本在注入 memo 里的关联键 = 服务内 writeVersion（内存计数器），非磁盘版本。
4. **双语 + 品牌（P3a-4）**：`krm.*` 文案进 `locale.ts`（zh 事实源 / en 平衡校验）；用户内容（规则/记忆正文）保持原文不翻译；样式走既有 `--bc-*` 令牌（品牌主色来自 branding，无新增品牌字符串）。

5. **记忆开关（追加需求，2026-08-20）**：
   - **单条启用**：`memoryRecord` 加 `enabled`（zod `.default(true)` 向前兼容）；停用的记忆不进注入索引段（与规则语义一致）。
   - **记忆总开关**：`bc_krm` 域加 `global` 单例 `{ memoriesEnabled }`（`initial: true`）。关闭后全局 + 工作区记忆一律不注入——`memoryIndexText` 先查总开关再按作用域/单条过滤。`/ext krm.memories.state` / `krm.memories.setState`。UI 记忆 tab 顶部总开关 + 记忆行单条开关 + 表单启用开关。
   - **前向兼容确认**：加 `global` 不 bump 版本——旧文件 `global: null` 视为从未写入，打开时 serve `initial`；表记录缺 `enabled` 由 zod default 补齐（运行时已验证 `global: null` 时按 initial 读 true）。
6. **AI 自动沉淀记忆（P5 后置增强提前落地，2026-08-20）**：docs/04-spec §3.6「会话中自动沉淀记忆」提前实现。
   - **模型面工具 `bc_write_memory`**（`packages/capability-core/src/memory-tool.ts`，`ctx.tools.register` + `defineTool`，tool-cordis 同款姿势）：参数 name/content/memoryType 必填，feedback 强制 why/howToApply，description 可选（缺省留空）。
   - **门控 = 动态注册/注销**：`KrmService.onMemoriesEnabledChange` 监听总开关，`apply` 里 `syncMemoryTool` 按 `isMemoriesEnabled()` 动态 register/unregister——开关关闭时工具不在模型工具集（模型看不到也调不到，`unknown tool`）；execute 内再 fail-closed 复检（防竞态双保险）。记忆引导段 `bc:memory-guidance`（order 110）同样按开关返回空/非空文本。
   - **写入逻辑** `KrmService.writeMemory`：标题归一化 + 编辑距离（≤2）去重（命中已有记忆则更新而非重复新增，TAM L1 低成本查重思想）；作用域按类型自动推导（project → 当前会话工作区，其余 → 全局）；新鲜度按类型分档（project 7 / reference 90 / 其余 30）。写后 `bump()` → 注入 memo 失效 → 下一装配即反映在索引。

## 放弃/偏差

- 存储用 `ctx.storage` domain（D4 低量实体路径），未引 SQLite——与 cron 执行记录（JSON，见 P4-0 笔记）分层一致；S8 storage 版本演练完整版留 P5。
- 记忆写入「仅手动管理」（docs/04-spec §3.6：P3 首版不自动沉淀）。
- `lastAccessedAt` 预留但本期不写（无自动召回统计通道）；新鲜度基准 = `updatedAt`。
- 规则仅全局级（§3.5），未建工作区级规则。

## 验证（运行时冒烟，全链路）

- 应用启动：`bc-capability-core: cron scheduler started` 打印于 krm init 之后 → storageDomain 解析、`bc_krm` 打开、注入接缝注册全部通过；修复前（域名含连字符）loader 报 `domain name 'bc-krm' must match /^[a-z][a-z0-9_]*$/`。
- 写读往返：UI 建规则「简洁回复」+ 建工作区级 project 记忆「P3a 注入链路验证」→ `storages/bc_krm.json` 落盘正确（unit name+version、两表字段完整，含 workspaceId + freshnessWarningDays=7）。
- **S4 注入**：真实会话发消息 → 解压 session log：`request/header.header.system` 含 `## 行为规则` 段；runtime-context `user/message` 含 `Current runtime context... # 记忆索引` 段；模型回复能引用两条注入内容；工作区过滤生效（ws-spike 会话收到 ws-spike 记忆）。
- 前端 CRUD：建/列/开关（update 落 enabled=false + 新 updatedAt）/删全通；类型分档预设（项目→7 天）；作用域切工作区出现工作区下拉（来自官方 workspace store）；feedback 强制校验；删除确认。
- 双语：切 en 后设置页「Rules & Memory」/New Rule/Enable/Edit/Delete/空态/「Don't remember」全出英文，无 key 原文残留（S10 该项通过）；语言偏好持久化 `settings.yaml locale.preference: zh` 并已切回。
- **记忆开关（追加）**：基线（单条开 + 总开关开）→ 记忆注入；单条关（总开关开）→ 当前回合新快照无记忆索引（模型仍引用历史回合，符合预期）；单条开 + 总开关关 → 新快照无记忆索引（总开关压过一切，模型自己注意到"这轮没有新快照"）；持久化验证 `storages/bc_krm.json`（`global.memoriesEnabled` + 单条 `enabled` 写读一致）；总开关关闭时 UI 显示「关闭后，全局与工作区记忆都不再注入会话」提示。
- **AI 自动沉淀（P5 提前）**：开关开 → 发「记住我偏好简洁回复」→ 模型调 `bc_write_memory`（session log `tool-call-chunks` 确认）→ 落盘 `偏好简洁直接回复`（user/global，模型自选了类型+写了描述）→ 工具结果回给模型 → 助手「已记住」。开关关 → 工具动态注销 → 模型再尝试得到 `Tool call Error: unknown tool "bc_write_memory"`（UI 明示）→ 助手诚实报告无法保存 → **无新记忆写入**。
- 构建质量：capability-core + web-ui `tsc --noEmit`、`esbuild build`、`eslint` 全绿。

## 踩坑记录

- `defineDomain` 模块加载期校验域名（`UNIT_NAME_RE` 无连字符）——域名必须 `bc_krm`。
- 铁律 4 lint：`styles.ts` 的 SHELL_CSS 是模板字面量，**CSS 注释里也不能出现中文**（TemplateElement 会被 `no-restricted-syntax` 当 copy 命中）。
- `exactOptionalPropertyTypes` 下向前端 `createMemory` 传 `workspaceId: undefined` 编译失败——payload 用条件展开（仅工作区作用域且值存在时携带该键）。
- adapter `listWorkspaces` 走官方 live store 快照（`ctx.workspaces.list.getSnapshot()`），不经 /ext——保持工作区唯一事实源在上游。
