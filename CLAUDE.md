# CLAUDE.md — BC Agent Desktop

deepseek-harness（dsh）的插件化桌面外壳。**上游核心零修改**：所有定制以标准插件 + profile 叠加实现。

## 仓库布局

* 产品代码：`apps/`（Electron 壳 + 前端原型）、`packages/`（`@bc-agent/*` 插件：`web-ui`、`capability-core`、`file-open`）、`profiles/`、`branding/`、`scripts/`。

* `docs/`：设计规格与开发规范；`docs/任务看板.md` 是开发任务的唯一驱动入口，`docs/06-skill-standard.md` 是技能编写标准。

* `.claude/`：AI 开发规范正典（`skills/` 开发工作流技能、`notes/` 非平凡决策留痕、`roles/` 子代理角色提示词）。

* `.trae/`：Trae 编辑器技能桥（本地 junction，不入库，经 `scripts/setup-agent-links.ps1` 重建）。

* `reference/`：只读资料镜像（上游源码 + demo + 设计文档），git 忽略，经 `pnpm run sync:reference` 更新；**绝不 import、绝不改动、绝不提交**。

* `upstream.json`：钉住的上游 npm 版本 + reference SHA，升级必须更新它。

## 铁律

1. **不改上游源码**（[docs/02-goals.md §1 G2](docs/02-goals.md)）。
2. **上游触点单点**：前端官方调用收 `packages/web-ui/src/adapters/upstream.ts`；Host 插件只用文档化 `ctx.*`。
3. **锁版本 + 冒烟**：升级 = 改 `package.json` 版本 + 跑 S1–S10 冒烟 + 更新 `upstream.json`；同步 reference 不是升级。（冒烟脚本尚未落地，清单见看板 P5-0。）
4. **双语**：zh 为 key 集事实源，en 编译期校验平衡（`ctx.locale.register(ns, {zh,en})`）。
5. **品牌单源**：用户可见品牌字符串只经 `branding/`，代码禁止硬编码。
6. **数据不出本机**：loopback-only、凭证不落明文、工作文件落用户自选目录（不落 C 盘）。

## 命令

```sh
pnpm install                    # 安装 workspace 依赖
pnpm run typecheck              # 全 workspace typecheck
pnpm run lint                   # 全 workspace lint
pnpm run sync:reference         # 更新 reference/ 只读镜像
pnpm --filter desktop dev       # 起 dsh Host（叠加 bc-agent profile）
pnpm --filter desktop dist      # Electron + NSIS 打包（Electron/builder 工具下载自动走 npmmirror 镜像，可用 ELECTRON_MIRROR 覆盖）
pnpm --filter desktop verify:installer   # 安装包静态校验
```

## 权威约定

写插件时，dsh 的契约以 `reference/upstream/docs/` 与 `reference/upstream/packages/*/AGENTS.md` 为准。bc 不重复抄录，只链接：

* ESM only；`strict: true`；每次贡献走 `ctx.effect()`/`ctx.on()`，注册表 `register()` 返回 disposer。

* capability seam 三件套（Service Definition / Provider / Consumer）。

* 模型可见 ⟺ 落日志；closed union 用 `assertNever`。

* 无硬编码 tunable：部署可调项进 `Config`，从 cordis.yml 可改。

* 测试描述行为，不描述正确性。

* 文件末尾恰好一个换行。

## AI 执行约定（省 token）

* **局部读取**：改大文件（>300 行）前先 Grep 定位，再用 Read 的 offset/limit 只读改动点附近区段，禁止无差别整读。

* **最小锚点编辑**：Edit 的 `old_string` 取最小唯一片段；同类多处修改用 `replace_all` 一次完成；Write 整文件仅限新建，改既有文件一律局部 Edit。

* **任务隔离**：一个任务一个会话（或先 `/clear`），避免无关历史抬升每轮开销。

* **探索收窄**：检索优先 `files_with_matches` 与 `head_limit`；单点查询不派子代理。

