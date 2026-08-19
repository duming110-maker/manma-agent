# P0-2 清单：slot 注册去向 + conversation 样式变量

- 版本：v1（2026-08-18，P0-2 产出）
- 上游事实来源：`reference/upstream`（git SHA `99f6f02f`，npm `0.1.0-rc.7`）。文中路径均相对 `reference/upstream/`。
- 用途：(a) 是 S1 冒烟「slot 注册去向核对」的底表；(b) 是 P2 换肤层（覆盖 `--dsw-*`）的盯梢基础。升级上游时逐条重核。

## 前置事实（P0-2 实证）

- `root` 是 runtime 内建的 slot（`packages/client/runtime/src/client/slots.ts` L20–58：SlotMap 种子 + "DO NOT register here… a second entry shadows it"）。shell 只渲染 `root`（`packages/client/web/src/app-shell.ts`：`inject = ['slots', 'sessions', 'layout']`，安装 renderer 后 provide `appShell`）。
- 官方 `ui-layout` 的唯一一次 `register({ name: 'root', children: {sidebar, conversation, details, shell.overlay} }, AppFrame)` 在 `packages/client/ui-layout/src/client/index.ts` L120–137；同插件还做了两件与 root 无关但全局必需的事：
  1. `ctx.reflect.provide('layout', LayoutController)`（panel 动作面，`src/client/service.ts`：`toggleSidebar/openDetails/closeDetails`）；
  2. ThemePresenter 落 DOM（`src/client/theme-presenter.ts`：`html { color-scheme }`、`body[data-ds-dark-theme]`、主题 alias-token 内联覆盖、`meta[name=theme-color]`）。
- 浏览器 roster 的注入链：web bundle 的行（`packages/bundle/web-app/cordis.patch.yml` "browser plugin roster" insert 列表）→ client-modules 节点半扫描启用行中声明 `dsh.client { platform: 'web' }` 的包（`packages/client/modules/src/index.ts`，解析锚点是 profile 目录 `ctx.baseUrl`）→ `window.__DSH_BOOT__`（`injectBootManifest`）+ `/plugins/<包名>/client.js`。
- 浏览器激活顺序由「服务名 inject 等待」决定：boot 结束时**所有 entry 必须 ACTIVE**，否则整页停在 loading 页并逐条报 pending 服务（`packages/client/web/src/boot.tsx` `assertEntriesActive`）。`dsh.client.inject`（package.json）只是 boot graph 的信息性边（`packages/client/modules/src/client/manifest.ts` L46–49 注释）。
- 除 ui-layout/ui-sidebar/ui-conversation 外，**所有**官方 ui-* 插件对他人 seat 的注册都走 `ctx.slots.inject(key, cb)`（声明注入，等声明出现再注册，顺序安全；`packages/client/runtime/README.md` "Slot declaration injection"）。

## 清单 (a)：官方 ui-* 插件 slot 注册去向（禁用 ui-layout 行后）

读法：列 = 该插件浏览器半注册/注入的 seat；「去向」= 该 seat 由谁声明。**我们的 bc-web-ui 重新声明了 root 的四个子 seat（键/类别/作用域与官方一字不差），并把 ui-layout 原有的 `layout` 服务面与 ThemePresenter 重新就位**——这两点是禁用后不塌的前提。

### 直注册进 root 四子 seat 的插件（激活顺序被 `layout` 服务钉在我们之后，安全）

| 插件 | 注册 | 声明的子 seat | 禁用 ui-layout 后 | 出处 |
|---|---|---|---|---|
| ui-sidebar | `'sidebar'`（single/root） | `sidebar.workspaces`、`sidebar.settings`、`sidebar.footer.action`（均 root） | 仍激活（`layout` 由 bc-web-ui 提供）；SidebarRoot 注册进我们声明但**不渲染**的 `sidebar` seat（spike 自研侧栏占据左列） | `packages/client/ui-sidebar/src/client/index.ts` L26 inject、L41–55 register |
| ui-conversation | `'conversation'`（single/session-maybe）、`'details'`（single/session） | `conversation.session`、`conversation.session.header`(+actions/utilities)、`conversation.composer`(chain)、`conversation.composer.bar`、`conversation.composer.dock`、`conversation.input.overlay/dock/left/right`、`conversation.hero.workspace/agentPreset`、`conversation.view`(list)、`conversation.details.tool`、`conversation.chat.node`(keyed) 等 | **完全保留**——这是 D2 的根基：官方对话面整树进我们声明的 conversation seat；DetailsPanel 进 details seat（spike 中列宽 0、保挂载） | `packages/client/ui-conversation/src/client/apply.ts` L51–54 inject、L196–234、L239–269、L444–454 |

### 经 `slots.inject`（声明注入）挂进上述 seat 的插件——全部保留，无需顺序担忧

| 插件 | 挂载点（slots.inject 目标） | 出处（client/index.ts） |
|---|---|---|
| ui-workspace | `sidebar.workspaces`、`conversation.hero.workspace` | ui-workspace L110 |
| ui-settings-general | `sidebar.settings`、`settings.trigger/header/close/action/section`（settings.* 族由其自身声明） | ui-settings-general |
| ui-settings-models | `settings.onboarding`、`settings.section` | ui-settings-models |
| ui-settings-plugins | `settings.section`、`settings.plugins.tab`、`settings.plugin.item` | ui-settings-plugins |
| ui-settings-plugin-inventory | `settings.plugins.tab` | ui-settings-plugin-inventory |
| ui-theme | `settings.general.item`（外观行） | ui-theme |
| ui-agent-preset | `settings.section`、`settings.general.item` | ui-agent-preset |
| ui-permission-presets | `settings.general.item` | ui-permission-presets |
| ui-model-selection | `conversation.input.model` | ui-model-selection L157 |
| ui-plan | `conversation.input.plan` | ui-plan L52 |
| ui-user-questions | `conversation.composer`（chain，问题接管） | ui-user-questions L56 |
| ui-commands | `conversation.input.overlay`（含 popupSelect 浮层） | ui-commands |
| ui-input-trigger | `conversation.input.overlay` | ui-input-trigger |
| ui-skill | `tool.call.toolview` | ui-skill |
| ui-subagent | `conversation.composer`、`conversation.session.header.actions` | ui-subagent |
| ui-jobs | `conversation.session.header.actions` | ui-jobs L30（多行 slots.inject） |
| ui-goal | `conversation.chat.node`、`conversation.input.dock` | ui-goal L51、L72 |
| ui-deliverables | `conversation.chat.turnTail`（多行形式） | ui-deliverables |
| ui-message-feedback | `conversation.chat.assistant-actions` | ui-message-feedback L60 |
| ui-tool | `conversation.chat.node`、`conversation.details.tool`、`tool.call.toolview` | ui-tool |
| ui-trajectory | `conversation.view`（第二个视图 tab） | ui-trajectory L43 |
| ui-workflow-run | `conversation.chat.node` | ui-workflow-run L24 |
| ui-conversation 自身 | `settings.general.item`（回车行为行） | apply.ts L137 |
| ui-directory-picker-native / -browse | `sidebar.workspaces.directoryFlow`、`conversation.hero.workspace.directoryFlow` | 各自 client/index.ts |
| ui-cordis / ui-attachment / ui-primitives | 无 seat 注册（渲染器/图元库，经 registry 协作） | — |

### ui-layout 独有、禁用后由 bc-web-ui 接管/替代的项

| 丢失项 | bc-web-ui 的接管 | 残差 |
|---|---|---|
| AppFrame 三栏框架（拖拽调宽、concession 收缩链、窄窗自动折叠） | 极简固定网格：240px 侧栏 + 1fr 对话列 + 0px 详情列 + 浮层 | P2 需求；侧栏调宽/折叠暂无 |
| `ctx.layout`（LayoutController） | 极简 no-op 面（`toggleSidebar/openDetails/closeDetails` 全 no-op） | 详情列暂不可开（`openDetails` 无效）：工具调用详情、trajectory 跳转的详情面板 P1/P2 再接真 store |
| ThemePresenter（快照→DOM） | 同契约极简实现（colorScheme + `data-ds-dark-theme` + alias-token 内联 + theme-color meta） | 无（行为等价） |
| root 声明 + 四子 seat | 键/类别/作用域原样重声明 | 无 |

### 已确认不塌的机制依据（升级盯梢点）

1. shell 自身（app-shell entry）inject `['slots','sessions','layout']`——`layout` 必须有人提供，否则整页停在 loading（`packages/client/web/src/app-shell.ts` L30）。
2. ui-conversation/ui-sidebar inject `layout`（apply.ts L51、ui-sidebar index.ts L26）——同上。
3. 直注册（非 slots.inject）进他人 seat 的只有 ui-sidebar/ui-conversation 两个（对本清单全量 grep 的结论）；二者都被 `layout` 钉在 bc-web-ui 之后激活，因此「先声明后注册」成立。
4. 单 seat 第二注册是**遮蔽**不是并列（`runtime/src/client/slots.ts` L31–37 对 root 的说明；SlotCore 语义）：因此不要往 `sidebar` 再注册想「叠加」官方侧栏。
5. boot graph 中残留的 `inject: ["@deepseek-ai/dsh-client-ui-layout"]` 元数据边（ui-sidebar/ui-conversation 行上）只是信息性字段，不参与激活（manifest.ts L46–49）——实测存在、无影响。

## 清单 (b)：conversation 组件树 `--dsw-*` CSS 变量（可覆盖/不可覆盖）

### 令牌分层与来源（ui-theme 的五个样式表，均由 shell bundle 链接：`packages/client/web/src/base.css` 的 @import——禁用 ui-layout 不影响它们）

| 层 | 定义文件 | 亮/暗 | 可否由我们覆盖 |
|---|---|---|---|
| `--dsw-static-*`（原始调色板：neutral / neutral-bluish / deepseek / blue / green / red / amber，共约 110 个键） | `design-platform.css` L4–154（`body` 与 `body[data-ds-dark-theme]` 两块） | 两块几乎同值（仅 `neutral-bluish-60` 亮暗差一档，L63/L139） | **可但不应**：上游设计平台原始层；改它=全局换色板，升级盯梢成本高。P2 原则：不动 |
| `--dsw-alias-*`（语义别名约 90 键 × 亮暗两表：`bg-base/bg-layer-1..3/bg-mask-*/bg-module-platform/bg-overlay/bg-skeleton`、`border-l1..l4(+darkmode-thin)/inverted*`、`label-primary/secondary/tertiary/caption/dimmed/primary-*/inverted`、`button-*-fill/hover`、`interactive-bg-*`、`state-*-primary/secondary/tertiary`、`markdown-*`、`scrollbar-*`、`toast-bg`、`tooltip-bg`、`brand-*`） | `design-platform.css` L156–338 | 两表分别定义 | **可覆盖——官方换肤通道**：skin-plugin 用 `html body { --dsw-alias-bg-*: … }` 提高选择器优先级覆盖（`reference/demo/skin-plugin/src/client.ts` 48–81 行做法）；上游主题系统本身也把活跃主题的 alias-token 覆盖以内联 CSS 变量写到 body |
| `--dsw-specific-*`（组件级：`sidebar-fill`、`sidebar-nav-item-active(-accent)/hover`、`bubble(-highlight)`、`input-major`、`login-input`、`menu`、`selector`、`tip`） | `design-platform.css` L235–245（亮）、L327–337（暗） | 两表 | 可覆盖（同 alias 手法）；侧栏观感主要吃这几个键 |
| `--dsw-font-*`（排版合成变量：`font-family` + 各字号档 `font-xxs-12 … font-xl-24`、`font-markdown-*` 系列，每档带 `-font-family/-size/-weight/-line-height` 子键）与效果键 `--dsw-shadow-lv1..3(-blur)`、`--dsw-mask-blur`、`--dsw-linear-*` | `base.css`（仅 `--dsw-font-family` + 三个 `--ds-*` 基础键）与 `gradient-shadow-text.css`（全部 `--dsw-font-*` 档位与效果键） | 单表（不分明暗） | 可覆盖（body 级）；换字体/字号体系从这里下手 |
| 主题内联覆盖 | ThemePresenter 把 `snapshot.active.tokens` 写成 body 内联变量（内置 light/dark 两主题 tokens 为空对象，`ui-theme/src/client/index.ts` L119–120） | 随主题 | **内联优先级最高**：P2 全局换肤优先走 ui-theme 的 override 面（`overrideTokens`，同文件 L281）而非自拼内联 |

注：base.css 还定义了 **无 `dsw-` 前缀** 的 `--ds-font-family-code`、`--ds-ease-in-out`、`--ds-transition-duration(-fast/-slow)`（`ui-theme/src/styles/base.css`）——迁移自上游 deepsuite 主题；conversation 的动效/代码字体吃这些键，P2 盯梢时不要只 grep `--dsw-`。

### conversation 树实际消费的键（`packages/client/ui-conversation/src/client/**/*.module.css` 全量 grep `var(--dsw`，50 个键；括号=出现次数）

- 文字（最高频）：`alias-label-tertiary`(40)、`alias-label-primary`(25)、`alias-label-secondary`(24)、`alias-label-caption`(19)、`alias-label-primary-dimmed`(2)、`alias-label-dimmed`(2)、`alias-label-primary-bluish`(1)
- 交互：`alias-interactive-bg-hover`(14)、`alias-interactive-bg-hover-solid`(2)、`alias-interactive-bg-hover-danger`(2)
- 状态/主色：`alias-state-business-primary`(8)、`alias-state-error-primary`(7)、`alias-state-warn-primary/secondary/tertiary/label`(3/1/1/1)、`alias-state-success-primary`(1)、`alias-state-business-tertiary`(1)、`alias-button-info-fill`(2)、`alias-button-info-hover`(1)、`alias-button-floating-fill/hover`(1/1)
- 面板/层次：`alias-bg-base`(7)、`specific-bubble`(1)、`specific-tip`(2)、`specific-input-major`(2)、`specific-menu`(1)、`specific-selector`(1)、`alias-bg-module-platform`(1)、`alias-bg-skeleton/overlay`（scrollbar.css/shiki.css 关联）
- 边框：`alias-border-l2`(7)、`alias-border-l1`(4)、`alias-border-l3`(2)、`alias-border-l4`(1)、`alias-border-l2-darkmode-thin`(1)、`alias-border-inverted`(1)
- 代码块（AssistantMarkdown）：`alias-markdown-code-block`(3)、`alias-markdown-inline-code/tag/citation/…`（design-platform 键全存在）
- 滚动条：`alias-scrollbar-bg-l2`(4)、`alias-scrollbar-hover-l2`(4)（l1 见 scrollbar.css）
- 排版/效果：`font-family`(3)、`font-xs-13`(2)、`font-s-strong-14`(1)、`font-markdown-code-block-small`(2)、`shadow-lv2`(3)、`shadow-lv3`(1)
- 直引 static 层（少量，说明部分组件绕过 alias）：`static-deepseek-500`(4)、`static-deepseek-200`(1)、`static-blue-450`(1)、`static-neutral-bluish-400`(1)

### 不可覆盖 / 缺口（盯梢要点）

- **悬空键（上游缺口，实测）**：`--dsw-alias-separator-primary`（StatsLine.module.css:23）与 `--dsw-alias-line-secondary`（ContextBody.module.css:19）被消费但**在全部五个 ui-theme 样式表中均无定义**（全仓 grep 无定义处）——解析为空，实际落到 UA 初始值。P2 换肤若依赖它们需自定义补齐，并列入升级盯梢（上游补定义后优先用上游值）。
- 组件内少量**字面量色**：conversation 各 module.css 中 `rgba(` 字面量仅 3 处（阴影/mask 类），换肤残差风险小但非零。
- **CSS Modules 类名哈希**（`[hash]_[local]` 模式，`packages/client/tsdown.client.ts` cssModules pattern）：不可从外部选择器定位——外部换肤只能走变量覆盖，不能走类名覆盖。
- `data-ds-dark-theme`（body 属性）是暗色调色板的**选择器开关**，由 ThemePresenter 写入；换肤层必须保持「亮暗两表 + 该属性」成套语义，只改一边会出现亮色残留。
- `--dsw-alias-brand-*` 键当前指向 neutral（非品牌色）；官方实际主色键是 `alias-button-info-fill/hover` 与 `alias-state-business-primary`（deepseek 蓝系）。P2 品牌主色落点应选 alias 层，别误绑 `brand-*` 键名语义。

### 升级盯梢触发器（S1/S7 联动）

- `design-platform.css` / `gradient-shadow-text.css` / `base.css` 任意键**改名/删除** → P2 换肤层静默失效：升级 diff 必查键集合（可 `grep -oE '\-\-dsw-[a-z0-9-]+' | sort -u` 前后对比脚本化）。
- `ui-theme` ThemeSnapshot/`overrideTokens` 契约、ThemePresenter 落 DOM 的键集合变化 → bc-web-ui 的极简 presenter（`packages/web-ui/src/client/theme.ts`）同步。
- ui-conversation 新增 module.css 消费新键 → 上节清单扩容；悬空键是否已被上游补定义。
