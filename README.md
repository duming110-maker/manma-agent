# BC Agent Desktop

单用户、本地数据、可开源分发的 AI Agent 桌面应用。以 deepseek-harness（dsh）为插件化运行时，自研前端外壳 + 业务能力插件。

## 这是什么

- **不是 fork**：上游 `@deepseek-ai/dsh-*` 全部走 npm 依赖，核心代码零修改。
- **三层**：Electron 桌面壳（`apps/desktop`）→ 上游 dsh（npm 依赖）→ 业务插件（`packages/` 下 `@bc-agent/web-ui`、`@bc-agent/capability-core`、`@bc-agent/file-open`，profile 叠加）。

## 目录

```
├── apps/            Electron 壳（desktop）+ 前端原型（frontend-user，仅移植参考）
├── packages/        bc 插件包（web-ui / capability-core / file-open）
├── profiles/        cordis.patch.yml 组装
├── branding/        品牌配置（多品牌白标）
├── scripts/         打包 / reference 同步 / agent 桥接脚本
├── docs/            设计规格文档（规格权威来源；v0.8 规划正文在 spec-v0.8-archive/ 冻结存档）
├── .claude/         AI 开发规范正典（skills + notes + roles）
├── .trae/           Trae 技能桥（本地 junction，不入库）
├── reference/       只读资料镜像（git 忽略，见下）
├── upstream.json    钉住的上游版本 + reference SHA
└── CLAUDE.md        AI 开发规范（铁律/命令/约定）
```

## 开发与运行

前置：Node `^22.19.0 || >=24.0.0`、pnpm 11.7.0（`corepack enable` 后由 `packageManager` 字段自动钉住）。

```sh
pnpm install                     # 安装 workspace 依赖（首次）
pnpm --filter frontend-user dev  # 起 frontend-user 开发服务器 → http://localhost:3000
pnpm --filter @bc-agent/web-ui build
pnpm --filter @bc-agent/capability-core build
pnpm --filter desktop dev       # 起 dsh Host（叠加 bc-agent 布局补丁，127.0.0.1 随机端口，日志打印地址）
pnpm --filter frontend-user build
pnpm run typecheck               # 全 workspace typecheck
pnpm run lint                    # 全 workspace lint
```

`apps/frontend-user` 是自研 UI 原型（mock 数据、无后端），仅作 `packages/web-ui` 的移植参考。日常开发与打包：

```sh
pnpm --filter desktop dev         # 起 dsh Host（叠加 bc-agent profile）
pnpm --filter desktop dist        # Electron + NSIS 打包
```

## reference/ 同步

`reference/` 是只读资料镜像（上游源码 + demo + 设计文档），**不进 git**，开源发布时不暴露。团队任何人拉取/更新：

```sh
pnpm run sync:reference   # 或 node scripts/sync-reference.mjs
```

它按 `upstream.json` 钉住的分支/SHA 更新 reference。

> **同步 reference ≠ 升级上游依赖。** 升级 = 改 `package.json` 里 `@deepseek-ai/dsh-*` 版本 + 跑冒烟清单（S1–S10）+ 更新 `upstream.json`。

## 设计规格

全部设计决策见 [docs/README.md](docs/README.md)（规格文档总入口）。AI 开发规范见 [CLAUDE.md](CLAUDE.md)。

## 状态

基础功能已基本可用（2026-08-28）：P0 可行性 spike 六卡通过（产出见 `docs/spike/`）、P2 外壳三页与会话流程落地、P3a 规则与记忆上线、P4 cron 引擎与技能市场可用、P1-0 桌面打包（Electron + NSIS）通过。剩余为收尾（P2-f 双语文案、P3b-2/3 技能启停与强制选工作区）与发布工程（P5 冒烟/备份/自动更新），执行视图见 [docs/任务看板.md](docs/任务看板.md)，决策留痕见 `.claude/notes/implemented/`。
