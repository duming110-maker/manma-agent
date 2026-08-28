# v0.8 规格存档（冻结）

> **本目录为冻结存档**（2026-08-28 起冻结）：五篇 v0.8-draft 规格撰写于代码落地之前（2026-08-18），其中大量"将来时"的规划描述已由实际实现部分取代或修正。**正文从此不再改写**，仅作历史权威与决策依据留存；现状与代码事实以 [../README.md](../README.md) 的「现状与规划对照」为准。

## 权威定位索引（现役文档引用本目录时使用）

| 权威内容 | 所在文件 |
|---|---|
| G2 工程目标（**上游核心零修改**，六条铁律的源头） | [02-goals.md](02-goals.md) §1 |
| 目标 / 非目标 / 约束 C1–C10 / P5 发布成功标准 | [02-goals.md](02-goals.md) |
| S1–S10 冒烟清单 | [03-architecture.md](03-architecture.md) §7 |
| 决策 D1–D14、规划的仓库结构 | [03-architecture.md](03-architecture.md) |
| 功能规格 F1–F10、数据模型、`/ext` API 面、分期计划 P0–P5、风险 R1–R23、三方评审结论 | [04-spec.md](04-spec.md) |
| 外部材料索引、v0.8.1→dsh 概念映射、TAM 评估与上游源码级调研存档 | [05-references.md](05-references.md) |

## 勘误（外置，不回改正文）

- [01-background.md](01-background.md) §2.5 与 [05-references.md](05-references.md) §1 引用的 `demo/TencentDB-Agent-Memory/` **未入 reference 镜像**（已从根 `upstream.json` 的 demoDirs 移除）；其评估结论仍有效，见 [05-references.md](05-references.md) §3 与 [04-spec.md](04-spec.md) §10.1。
- 规划的 6 个包（capability-workspace/-cron/-skillx/-krm、shell）实际合并为 3 个包：`web-ui`、`capability-core`、`file-open`，见现役 README 对照表。

## 现役文档

- [../README.md](../README.md) — 规格文档总入口 + 现状与规划对照（代码事实基线）
- [../06-skill-standard.md](../06-skill-standard.md) — 技能编写标准
- [../任务看板.md](../任务看板.md) — 开发任务看板（执行视图）
- [../产品方案-202608.md](../产品方案-202608.md) — 立项/成本论证
- [../spike/](../spike/) — P0 spike 结论存档
