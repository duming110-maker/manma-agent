# 03 总体架构

- 版本：v0.8-draft（2026-08-18）
- 上级文档：[README.md](README.md)

## 1. 三层架构总览

```
┌─────────────────────────────────────────────────────────────┐
│ 发行物：BC-Agent-Desktop-Setup.exe（NSIS）/ .dmg（后置）      │
├─────────────────────────────────────────────────────────────┤
│ L1 桌面壳（自建，Electron，精简）                            │
│  · 壳本身 = 一个 Cordis 插件（bc-desktop-shell）             │
│  · 单实例锁 / loopback webserver 强制 / contextIsolation     │
│  · 打包 node+pnpm 私有运行时（不污染系统 PATH）/ 托盘         │
│  · 自动更新（版本轮询 + 下载校验 + NSIS 重装）               │
├─────────────────────────────────────────────────────────────┤
│ L2 上游 dsh（纯 npm 依赖，锁版本，零修改）                   │
│  dsh-base + dsh-web-app + 官方前端 dist + 官方 /api 网关     │
│  （含官方 workspace 注册表、权限预设、system-prompt 注册表）  │
├─────────────────────────────────────────────────────────────┤
│ L3 我们的定制层（全部是标准插件，独立 repo，profile 叠加）   │
│  · bc-web-ui          UI 布局插件：占 root slot，自研外壳    │
│  · bc-capability-*    业务能力插件组（host 侧 + /ext 通道）  │
└─────────────────────────────────────────────────────────────┘
```

运行时进程模型（单一 Electron 进程内的 Cordis root，与参考项目一致）：

```
Electron main 进程
 ├─ Cordis root（dsh Host：base + web-app 插件树 + 我们的全部插件）
 │   └─ webserver @ 127.0.0.1:<随机端口>
 │       ├─ /api/*        官方 RPC（会话/工作区/设置/凭证/技能/模型）
 │       ├─ /ext/*        我们的业务 RPC（优先经 connection.rpc.handle
 │       │                 注册，继承官方信任栅栏；见 D3'）
 │       └─ /             前端静态资源（官方 dist 或我们的 UI）
 └─ BrowserWindow（renderer）
     └─ 加载 http://127.0.0.1:<port>/（自研外壳 + 官方对话区子 slot）
```

## 2. 关键技术决策

| # | 决策 | 选择 | 备选与否决理由 |
|---|---|---|---|
| D1 | 前端形态 | **UI 布局插件**：禁用官方 `ui-layout` 行，`bc-web-ui` 占 `root` slot 并声明 `sidebar/conversation/details/shell.overlay` 子 slot，官方对话等组件注册为子 slot 内容 | ① 完全替换 dist（patch `web-runtime` 的 `distIndex`）：需自研全部对话 UI 且直接耦合无版本的 `/api` 协议，升级成本最高；② 纯皮肤插件（仿 skin-plugin）：改不了导航与页面结构，无法承载多页功能结构 |
| D2 | 对话区 | 嵌入官方 conversation slot 组件；后期用 `conversation.chat.node` 渲染器机制逐块换肤 | 自研对话 UI：流式/工具渲染/审批/plan/用户问答是官方约 20 个 ui-* 插件的工作量，且协议无版本承诺 |
| D3 | 通信 | 官方域（会话/工作区/设置/凭证/技能/模型）走官方 `/api`；业务功能走 `/ext` 通道——**v0.5：优先经 `connection.rpc.handle('/ext', ...)` 注册**，自动继承官方信任栅栏（Host 头 loopback/trustedHosts、`sec-fetch-site: cross-site` 拒绝、Origin 一致性、POST 强制 JSON）与统一 RPC 信封 | ① 扩展官方 `RpcMethodMap`：点分方法表编译期锁定，确不可行；② `intercept('/api')`：座位已被 Typert 网关占用（每通道仅一个拦截器）；③ `webServer.register` 裸路由：官方明言「Knows no harness concepts」，栅栏全部自研并需持续跟随上游语义——退路方案，须复刻三项检查并加冒烟；④ 全走自建 WS：丢官方栅栏与信封，最差 |
| D4 | 业务存储 | **分层（v0.5）**：低量实体（krm 二表/技能元数据/工作区扩展表/模板）走 `ctx.storage` 的 `defineDomain` 版本化 domain 机制；高增长实体（cronExecutions）**第一天进插件自有 `node:sqlite` 库**（含保留策略与索引），不碰上游库 | ① 全部 `ctx.storage`：json 后端是每 domain 单文件整域重写，执行记录只增不减会拖垮写入；② 全部自建 SQLite：低量实体自管 schema 无收益。切换红线：单一 domain 文档数 > 5 万或出现分页/倒排需求 |
| D5 | 记忆 | 自建四类型记忆（对齐前端 UI 与 v0.8.1 §6 设计），`ctx.storage` domain 存储 + system-prompt 接缝注入；落日志由官方 `request/header` 快照承担 | TencentDB-Agent-Memory sidecar：见 [04-spec §10.1](04-spec.md) 论证（打包/成本/模型不匹配，三方评审一致同意不引入） |
| D6 | 定时任务 | 自建 cron 插件：**cron-parser 类成熟库**解析表达式/计算下次触发（含时区），`cordis-plugin-timer` 仅作毫秒 interval/timeout 底层载体 + `ctx.sessions` 起会话执行 + 执行记录入自有 SQLite | ① 依赖 timer 的 cron 能力：**不存在**（timer 仅 timeout/interval/throttle/debounce，v0.5 事实修正）；② 系统计划任务（Windows Task Scheduler）：跨平台差异大、安装复杂、不可移植 |
| D7 | 工作区 | **v0.5：复用上游官方域**——上游 `workspaceRegistry` 为唯一事实源（`workspace.list/create/rename/delete/insertBefore/insertSessionBefore/archiveSession` RPC + `session.create({workspaceId})` 创建即以工作区目录为 cwd 并归组）；bc 薄层仅做：**首次启动强制选工作区（原生文件夹选择框，不自动建目录）** + 业务扩展元数据（status/ownerId，以官方 WorkspaceId 为键的 KV 表） | v0.4 的自建 workspaces/sessionBindings 两表：与上游注册表几乎一一对应（path 唯一、创建时绑定、目录永不删、归档语义），重复建设且制造双事实源（三方评审一致否决） |
| D8 | 规则/记忆注入 | capability-krm 经上游 system-prompt 注册表贡献（`ctx.systemPrompt.section()/context()`，按可变性选型，见 04-spec §6）；**落日志由官方接缝自动承担**（C6 天然满足）：section 进 `request/header` 的 `header.system`，context 进 runtime-context `user/message` 快照；不自写会话事件 | ① 前端拼进 prompt 文本：违反上游铁律且不可重建；② 自写 session 事件：第三方自定义事件读取端默认拒绝（需 `ignorable: true`，live 写入面不暴露），且属上游未开放的注册面——不可行也不必要 |
| D9 | 桌面壳 | 自建精简 Electron 壳（借鉴参考项目架构，去除其 profile 多套管理/社区市场/ACL patch） | fork 参考项目：背负大量无关复杂度且其 UI 已被否定 |
| D10 | React 版本 | 自研前端降至 React 18.x（与官方 client runtime 共享运行时；官方声明 `^18.2.0`，以锁定版本实际解析为准，自建包锁同一 caret 范围） | 保持 19：两个 React 实例并存，slot 间组件无法互嵌 |
| D11 | 企业功能简化 | 数据模型保留 `status/scope` 类零成本字段（低成本预留多用户演进），UI 只做单用户流程 | ① 完全砍字段：多用户期硬迁移；② 完整保留审核流 UI：单机无意义 |
| D12 | 上游引入方式 | npm workspace 依赖锁定 + `upstream.json` 记录已验证版本与升级注意事项 | git submodule / vendor 源码：失去 npm 安装语义，且违反 C1 精神 |
| D13 | 会话删除 | **v0.5：直接映射官方 `workspace.archiveSession`**（从所有分组面隐藏 + 保留会话日志与工作区账户槽位 + 可恢复 + 幂等）；工作区删除映射官方 `workspace.delete`（仅移除注册，不动目录与日志） | 自建 /ext 隐藏标记表：与官方 archive 语义重复（三方评审一致否决）；物理删除：上游 append-only 铁律不提供，也确实不该提供 |
| D14 | 多语言 | **（v0.6）复用上游 locale 框架**：官方组件（conversation/settings 等）随官方 `locale` 偏好（设置 Language 行）自动切换；bc 自研外壳/页面经 `ctx.locale.register(ns, { zh, en })` 注册文案命名空间、渲染走 `t`（Translate）标准 seat；bc 用户菜单加语言快捷入口（写同一 `locale.preference`） | ① 自研 i18n 框架：重复上游 `dsh-client-locale`（注册表/双语平衡校验/持久化偏好/Language 行），无收益；② 仅做英文版：丢弃官方中文与用户中文场景；③ bc 自管语言状态 + 官方 locale 并存：双语言源、切换不同步 |

## 3. 我们的仓库结构（独立 repo：`bc-agent-desktop`）

```
bc-agent-desktop/
├── package.json                 # workspace 根（pnpm；含 node-pty 等原生依赖
│                                #   的 patchedDependencies 配置——上游 workspace
│                                #   的 pnpm patch 必须自带，见 R3/R18）
├── upstream.json                # 已验证的上游 dsh 版本 + 升级备注
├── branding/                    # 品牌配置（default/ + 各企业品牌）
├── apps/
│   └── desktop/                 # Electron 壳（main 进程 + electron-builder 配置 + 打包脚本）
├── packages/
│   ├── shell/                   # bc-desktop-shell：Electron 侧 Host 插件
│   │                            #   （单实例/托盘/更新/运行时 PATH 私有化/启动编排）
│   ├── web-ui/                  # bc-web-ui：客户端布局插件（frontend-user 移植目标）
│   │   ├── src/client/          #   侧栏/页面/主题（React 18，走官方 client runtime）
│   │   ├── src/host/            #   node 半：/ext 通道挂载、启动状态
│   │   └── src/adapters/
│   │       └── upstream.ts      #   ★ 官方 /api 与官方组件契约的单点适配层
│   ├── capability-core/         # /ext 通道框架（connection.rpc.handle 封装/退路栅栏）+
│   │                            #   业务数据导出导入（备份恢复）+ 自有 SQLite 基建
│   ├── capability-workspace/    # 工作区薄层（v0.8 瘦身：首次启动强制选工作区 + 扩展元数据表；
│   │                            #   注册/分组/归档/删除全部转发官方 workspace.*）
│   ├── capability-cron/         # 定时任务（cron-parser 调度 + 执行记录 + 手动触发）
│   ├── capability-skillx/       # 技能管理流（上传/安装/启停/统计）
│   └── capability-krm/          # 规则 + 记忆（存储 + system-prompt 注入）
├── profiles/
│   └── bc-agent/                # 组装 profile（cordis.patch.yml：禁用 ui-layout、插入我们的行）
├── scripts/                     # 打包 / 冒烟清单 / 上游升级检查 / 白标产物扫描
└── docs/                        # 本目录文档的最终归宿（从上游仓库迁出）
```

注：本目录已迁入 bc-agent-desktop 独立仓库的 `docs/`（实施启动）。文中出现的 `demo/`、`packages/`、`docs/` 等路径均指**上游 deepseek-harness 仓库**，在本仓库分别对应 `reference/demo/`、`reference/upstream/packages/`、`reference/upstream/docs/`、`reference/design/`（见 docs/README.md 路径映射）。

## 4. profile 组装（patch 叠加示意）

```yaml
# profiles/bc-agent/cordis.patch.yml（示意，字段以上游实际为准）
patch:
  # 1) 禁用官方 ui-layout 一行，让 bc-web-ui 占 root slot
  #    （官方 ui-sidebar/ui-conversation 等行保持启用——其组件注册到
  #     bc-web-ui 声明的子 slot 中被复用；patch 层 disabled 是官方用法）
  - id: ui-layout
    disabled: true
  # 2) 追加我们的 Host 插件行（insert 无位置定位语法：不带 id 时 append
  #    到列表尾；层序由 patch 来源层序保证——我们在 bc-agent profile 层
  #    追加，天然位于 web-app 层之后）
  - insert:
      - id: bc-capabilities
        name: '@bc-agent/capability-core'
      - id: bc-workspace
        name: '@bc-agent/capability-workspace'
      # ... cron / skillx / krm
  # 3) 浏览器 roster 追加 bc-web-ui 客户端插件（dsh.client 行）
  # 4) webserver 强制 loopback（壳层兜底，非用户可配）
```

## 5. 前端结构（bc-web-ui）

```
路由（BrowserRouter）：
/                 新建任务/欢迎页（工作区下拉（预选最近使用的工作区，首次启动强制选择）+ 技能 Chip + 输入区）
/c/:sessionId     会话页：自研页面骨架 + 官方 conversation slot 嵌入
/skills           技能页（市场/已安装 tab，v0.4 起无「企业级」）
/cron             定时任务页（模板/任务/执行记录 tab）
/settings         设置页：
                  ├ 规则 / 记忆 两 tab（自研，对接 /ext/krm）
                  └ 「DSH 设置」入口 → 官方 settings UI 作为内嵌视图

数据流：
· 官方域（会话/工作区/设置/凭证/模型）→ adapters/upstream.ts → 官方 /api
· 业务域（工作区扩展元数据/cron/技能元数据/krm）→ /ext 通道
· 会话创建流程：欢迎页选择 → adapters 调 session.create({ workspaceId })
  （必须显式选工作区；首次启动无任何工作区时强制走选择流程，否则不进入会话）
  → 需要非默认模型时 session.selectModel → 发送
  （侧栏「新建任务」入口为纯视图切换、不清当前选择——与官方 startSession
  立即建会话的行为是有意差异，避免仅点击就铸造 blank 会话）
· 业务态更新通知：/ext 通道提供变更信号（轻量轮询 bootstrap 或 WS 广播，P3 定稿，见 04-spec §5）
```

主题：完整移植 `frontend-user/src/globals.css` 的 CSS 变量令牌体系（暖灰 + 亮/暗双主题 + `bc-agent-theme` 持久化）；官方对话区通过覆盖官方主题 CSS 变量（`--dsw-*` 前缀，参考 skin-plugin 用法）跟随色调；`--dsw-alias-*` 变量名列入升级盯梢清单（重命名会让换肤层静默失效）。

文案/多语言：bc-web-ui 文案全部走 `ctx.locale`（注册 `bc.*` 命名空间 + `t` seat 渲染）；官方组件文案随官方 locale 自动切换；用户菜单提供语言快捷入口（写官方 `locale.preference`，与官方设置 Language 行同源）。

## 6. 安全模型（对齐参考项目纪律）

1. webserver 强制 `127.0.0.1` + 随机端口；壳层启动时校验，违反即拒绝启动
2. renderer：`contextIsolation` + Chromium sandbox + 无 Node 集成；`window.open`/外部链接转系统浏览器；导航/重定向同源校验
3. `/api` 信任栅栏由上游承担（Host 头校验、`sec-fetch-site: cross-site` 拒绝、Origin 一致性、POST 强制 `application/json`、特权方法仅 loopback）；`/ext` 通道优先经 `connection.rpc.handle` **继承同一栅栏**（D3'），退路方案必须复刻上述检查项（capability-core 统一实现 + 冒烟）
4. 凭证不落明文：走上游 credentials 体系（4 级优先级）
5. 定时任务无人值守权限：执行会话显式钉 `sandbox/mode = workspace-write` + `approval/policy = never`（两 knob 经 canonical setter 直设，非默认 `workspace-write` 预设；fail-closed 自动拒绝并留痕），避开 `danger-full-access` 预设；Windows 下沙箱为 ACL 受限令牌（partial 保证级别），威胁模型引用上游 sandbox-windows-acl 文档边界（详见 [04-spec §3.4](04-spec.md)）

## 7. 上游升级适配策略（D12 展开）

**原则：上游触点收敛 + 版本锁定 + 冒烟清单。**

1. **触点单点化与清单化**：前端所有官方调用收在 `packages/web-ui/src/adapters/upstream.ts`；Host 插件只用文档化的 `ctx.*` 服务（webServer/storage/sessions/workspaceRegistry/systemPrompt/connection.rpc/timer），禁止 import 上游包内部路径。Host 侧触点按包维护一份清单（capability-core 内文档），升级 PR 必须对照清单逐项确认
2. **版本纪律**：`upstream.json` 记录当前已验证版本 + 升级注意事项历史；升级 PR 必须更新它
3. **冒烟清单**（`scripts/smoke/`，每次升级必跑）：
   - S1 布局占位：禁用 ui-layout 后 root slot 正常渲染；**官方各 ui-* 插件的 slot 注册去向清单核对**（哪些进 sidebar/conversation/details/shell.overlay、哪些依赖 ui-layout 提供的中间层——防止悄悄消失）
   - S2 `/api` 关键 RPC：session.create/list/history/prompt、**workspace.list/create/archiveSession**、settings.describe、credentials.set、skill.list、llm.models
   - S2b 技能目录模型：项目级 `.agents/skills` 自动发现 + 同名项目覆盖全局 + watcher 刷新（上游 skill-filesystem rank 100-600 规则）
   - S3 `/ext` 通道全量可用（含信任栅栏行为：非 loopback Host / cross-site 请求被拒）
   - S4 注入可重建：规则/记忆注入后，**规则段在 `request/header` 事件的 `header.system` 快照、记忆段在 runtime-context `user/message` 快照**中可重建两段全文
   - S5 定时触发：手动触发一次 cron 任务全链路（create → selectModel → prompt → 执行记录）
   - S6 工作区 cwd 生效：`session.create({ workspaceId })` → 该目录 `.agents/skills` 下技能出现在会话 `skill.list`（上游原生机制确认）
   - S7 白标检查：以非默认 branding 构建的安装包，产物（窗口标题/包元数据/托盘文案/安装向导）grep 不到默认品牌名
   - S8 storage 版本演练：旧版数据目录 + 新版二进制的启动行为有明确结论；业务数据导出→导入往返一致
   - S9 **旧会话日志回归**：升级演练中，上一版本产生的会话日志在新版本可读（R13）
   - S10 **中英切换**：zh↔en 切换后 bc 自研外壳/页面文案无中文残留（en 态）且无缺失 key（fail-loud 不出现原文 key）；官方 conversation/settings 组件跟随切换
4. **上游 release note 盯梢点**：slot 契约变更、`RpcMethodMap` 增删、`workspace.*` 契约、`request/header` 事件结构、`connection.rpc` API、`ctx.storage`/`defineDomain` schema、技能目录格式、`dsh.client` manifest 要求、React 版本、`--dsw-alias-*` 主题变量名、**locale 契约（`ctx.locale`/`t` seat/`locale/change`/`LocaleNamespaceMap`）**、**记忆/知识相关新能力（上游若内置，触发 R23 评估）**
5. **允许的妥协**：上游破坏性变更时，优先在 adapter 层做版本分支（`UPSTREAM_MAJOR` 常量），其次锁旧版延期升级；绝不在上游源码上打 patch

## 8. 桌面壳范围（apps/desktop + packages/shell）

做（从参考项目裁剪）：

- 单实例锁；profile 启动编排（pending + last-known-good 回滚的最小实现，只一个 profile）
- 打包 node/pnpm 私有运行时 + `userData` 下私有 shim（不污染系统 PATH）；**独立 repo 必须自带上游 workspace 的 pnpm patch 配置（node-pty asar 适配等）与 `npmRebuild=false` + prebuilds 校验**（照抄 demo 解法清单，见 R3/R18）
- 托盘（打开主窗口/打开数据目录/检查更新/退出）
- 自动更新：版本 API 轮询 + 下载校验 + NSIS `--updated --force-run`（服务端为一个静态版本 JSON，初期可托管 GitHub Release）
- NSIS 安装器（可选安装目录/桌面快捷方式/「是否同时删除数据」卸载选项）；安装期检测 PowerShell 7（仅 PS 5.1 时非 ASCII stdin 可能误解码——中文产品高频风险，引导安装，见 R17）
- 数据目录：per-brand 独立 `DSH_HOME`（默认 `%APPDATA%/<brand-id>/dsh-home`，见 §9）

不做（裁剪掉）：

- 多 profile 管理（单 profile）；community market/fabric；Windows ACL 沙箱 patch（用上游默认 pwsh 沙箱，但引用其 partial 保证级别边界）；mac 公证/签名（后置）；手机远程

## 9. 品牌配置机制（白标，v0.3；v0.5 修订数据目录策略）

「BC Agent」仅为开发期代号；源码发布时支持按企业配置品牌，一套源码生成多个品牌安装版。

**单一事实源**：仓库根 `branding/` 目录（默认品牌 `branding/default/`），含 `branding.yaml` + 资产（应用图标/Logo/安装向导图）。Vite 构建与 electron-builder 打包全部从此读取；业务代码禁止出现品牌字面量（grep 脚本进 S7 产物扫描，覆盖源码与产物双重检查）；branding UI 文案字典按语言分键（`{ zh, en }`），品牌名/内置名称随语言提供双语文案。

| 类别 | 内容 | 随品牌变 |
|---|---|---|
| 可配置（用户可见） | 产品名/窗口标题/托盘与菜单文案、应用图标与 Logo、安装包文件名与 appId、更新源 URL、UI 文案字典（品牌名/内置名称等，**按语言分键 `{ zh, en }`**）、主题主色（可选） | ✅ `branding.yaml` |
| 固定（代码标识符，用户不可见） | npm scope `@bc-agent/*`、`ctx.storage` domain 键、自有 SQLite 库文件名、localStorage 键（如 `bc-agent-theme`）、工作区目录 `workspaces/`、`/ext` 路由前缀 | ❌ 固定代号 |

固定理由：磁盘路径与存储键若随品牌变化，换品牌或升级时用户数据不可迁移；npm scope 与路由前缀是代码契约，改动无收益。（v0.4 曾列「preset root 目录名」——v0.4 起已不生成 preset，移除。）

**多品牌数据目录（v0.5 修订）**：per-brand 独立 `DSH_HOME` **默认开启**（`%APPDATA%/<brand-id>/dsh-home`），同一机器可并行安装多个品牌版互不干扰——品牌版之间数据/凭证隔离是硬约束（C9），且独立目录让「卸载干净」可判定（卸载器可安全删除本品牌目录）。与官方 dsh CLI 或其他工具共享 `~/.dsh` 降级为 branding.yaml 显式 opt-in（面向高级用户；开启后卸载不删共享目录，S7 检查项相应调整）。

**构建入口**：`pnpm run dist -- --brand branding/<name>`（缺省 `default`）。

**合规**：品牌替换不改变开源义务——上游与全部依赖的 License、THIRD_PARTY_NOTICES 必须随每个品牌版一并分发（见 R7）。
