---
name: bc-agent-pre-push-checks
description: 推送前最小检查集合。当准备提交/推送改动、需要按 diff 选最小门禁（typecheck/双语/冒烟/打包）时使用——不默认全量跑，也不跳过该跑的检查。
whenToUse: 用户说「提交」「推送」「发 PR」或问「推送前要跑什么检查」
---

# BC Agent 推送前检查

用途：推送前选最小检查集合，不全量跑。

## 阶梯（由小到大）

1. 任何改动：`pnpm run typecheck`
2. 涉及 UI/文案/双语：+ 双语平衡检查 + 冒烟 S10
3. 涉及上游触点 / slot / 注入 / 存储：+ 对应冒烟（S1–S10，见 docs/）
4. 涉及打包 / 原生模块：+ 打包冒烟（P1 后）
5. 涉及技能改动（`.agents/skills/*`）：+ 按 `docs/06-skill-standard.md` 核对 frontmatter（name/description 必填、kebab-case、description 触发导向）

## 原则

- 不默认全量；按 diff 选最小覆盖。
- 冒烟清单 S1–S10 见 `docs/03-architecture.md` §7；技能标准见 `docs/06-skill-standard.md`。
- 冒烟未落地（`scripts/smoke` 尚不存在）时，标注「待 S 冒烟」并人工核对应清单项。
