# BC Agent Desktop

单用户、本地数据、可开源分发的 AI Agent 桌面应用。以 deepseek-harness（dsh）为插件化运行时，自研前端外壳 + 业务能力插件。

## 这是什么

- **不是 fork**：上游 `@deepseek-ai/dsh-*` 全部走 npm 依赖，核心代码零修改。
- **三层**：Electron 桌面壳（`apps/desktop` + `packages/shell`）→ 上游 dsh（npm 依赖）→ 业务插件（`packages/capability-*`，profile 叠加）。

## 目录

```
├── apps/            Electron 壳
├── packages/        bc 插件包（@bc-agent/*）
├── profiles/        cordis.patch.yml 组装
├── branding/        品牌配置（多品牌白标）
├── scripts/         打包 / 冒烟 / 同步 reference
├── docs/            设计规格文档（规格权威来源）
├── reference/       只读资料镜像（git 忽略，见下）
├── upstream.json    钉住的上游版本 + reference SHA
└── .agents/         skills + notes（AI 开发规范）
```

## 开发与运行

前置：Node `^22.19.0 || >=24.0.0`、pnpm 11.7.0（`corepack enable` 后由 `packageManager` 字段自动钉住）。

```sh
pnpm install                     # 安装 workspace 依赖（首次）
pnpm --filter frontend-user dev  # 起 frontend-user 开发服务器 → http://localhost:3000
pnpm --filter desktop dev        # 起 dsh Host（叠加 bc-agent 布局补丁，127.0.0.1 随机端口，日志打印地址）
pnpm --filter frontend-user build
pnpm run typecheck               # 全 workspace typecheck
pnpm run lint                    # 全 workspace lint
```

`apps/frontend-user` 是自研 UI 原型（mock 数据、无后端），P2 将移植为 `packages/web-ui` 布局插件。`apps/desktop` 当前是 P0 spike 形态的最小 Node 入口（Electron 壳是 P1）：首启自动构建并 `dsh plugin add link:` 安装 `@bc-agent/web-ui` 与 `@bc-agent/capability-core`，然后以 `dsh web --patch profiles/bc-agent/cordis.patch.yml` 启动——浏览器可见自研侧栏 + 官方对话区，业务探测 RPC 在 `/ext/ext.probe`。

## reference/ 同步

`reference/` 是只读资料镜像（上游源码 + demo + 设计文档），**不进 git**，开源发布时不暴露。团队任何人拉取/更新：

```sh
pnpm run sync:reference   # 或 node scripts/sync-reference.mjs
```

它按 `upstream.json` 钉住的分支/SHA 更新 reference。

> **同步 reference ≠ 升级上游依赖。** 升级 = 改 `package.json` 里 `@deepseek-ai/dsh-*` 版本 + 跑冒烟清单（S1–S10）+ 更新 `upstream.json`。

## 设计规格

全部设计决策见 [docs/README.md](docs/README.md)（规格文档总入口）。AI 开发规范见 [AGENTS.md](AGENTS.md)。

## 状态

P0 可行性 spike 六卡全部通过（2026-08-18）：frontend-user 入仓可构建、dsh Host 启动（npm 闭包 0.1.0-rc.7 锁定）、最小布局插件（D1/D2/D10 实证）、`/ext` 通道（D3' GO，S3 栅栏实测）、工作区机制（S6 成立，D7 纯转发定案）、打包形态（官方 loader 加载闭环）。产出见 `docs/spike/`，决策留痕见 `.agents/notes/implemented/`。下一步：P1 桌面壳（Electron + NSIS）。尚未对接 git、尚未开源。
