---
name: bc-agent-code-review
description: 代码评审工作流。当需要评审 bc-agent-desktop 仓库的改动/PR、核对是否违反铁律（上游零修改/锁版本/双语/品牌/数据安全/存储分层）时使用；也用于评审技能改动是否符合 docs/06-skill-standard.md。
whenToUse: 用户要求评审改动、合并前把关、或问「这改动有没有问题」
---

# BC Agent 代码评审

用途：评审 bc-agent-desktop 仓库的 PR/改动。

## 审什么（bc 特有）

1. 上游零修改：是否 import 了 `reference/`、是否改了上游语义、是否绕过 adapter 单点（`packages/web-ui/src/adapters/upstream.ts`）。
2. 锁版本：改 `@deepseek-ai/dsh-*` 版本是否同步 `upstream.json` + 冒烟。
3. 双语：新增文案是否走 `ctx.locale.register(ns, {zh,en})`、en 是否补齐（zh 为 key 源，编译期平衡校验）。
4. 品牌：是否有硬编码品牌字符串（应走 `branding/`）。
5. 数据安全：loopback-only、凭证不落明文、工作文件不落 C 盘（无自动默认工作区）。
6. 存储分层：低量 domain（`defineDomain`）/ 高增长自有 SQLite（cronExecutions）。
7. 技能改动：SKILL.md 是否符合 `docs/06-skill-standard.md`（frontmatter 的 name/description 必填、kebab-case、description 触发导向）。
8. 看板一致：改动是否落在 `docs/任务看板.md` 某张卡范围内，有没有顺手夹带范围外工作。

## 权威约定

dsh 契约以 `reference/upstream/docs/` 与 `reference/upstream/packages/*/AGENTS.md` 为准：
capability seam 三件套、slot 纪律（`packages/client/AGENTS.md`）、session event、`ctx.effect()`、ESM、strict、JSDoc。

## 流程

1. 读 `reference/upstream/AGENTS.md`（root）+ 本次改动涉及的包 AGENTS.md。
2. 读本仓库根 `AGENTS.md` 铁律。
3. 对照 diff 逐条核 bc 特有 + dsh 约定。
4. 输出：阻断问题 / 非阻断建议 / 需冒烟验证项。
