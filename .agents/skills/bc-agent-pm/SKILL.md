---
name: bc-agent-pm
description: 项目管理工作流。当需要从 docs/任务看板.md 推进开发任务时使用——派开发子代理、独立验收、派评审子代理、驱动返工循环；也用于把长任务拆成可验收卡、判定卡状态（待开始/进行中/待验收/通过/返工）。
whenToUse: 用户要求推进任务、派活、验收、评审，或问「下一步做什么」「看板状态」
---

# BC Agent PM 工作流

用途：主 agent 当项目经理——派开发子 agent、独立验收、派评审子 agent。

## 循环

1. 从 `docs/任务看板.md` 取下一个「待开始」任务卡（开发前先读 `docs/README.md` 的「现状与规划对照」，避免按过时规划开工）。
2. 组装开发子 agent prompt = `.agents/roles/developer.md` + 任务卡（目标/依赖/验收命令/产物）。
3. `subagent` 后台开发（让它先自测）。
4. PM 独立验收：重跑门禁（typecheck / test / 冒烟）。
5. 派评审：`.agents/roles/reviewer.md` + 开发产出 → 评审子 agent。
6. 返工 → `send_message` 带具体 diff 反馈回开发子 agent，回 3。
7. 通过 → 看板标完成；非平凡决策落 `.agents/notes/`；取下一个。

## 纪律

- 一个任务卡 = 一个验收门禁；同包 / 同文件不并发两个开发。
- 「开发自测」不是「验收」：PM 必须独立跑门禁或派评审。
- 长跑目标用 goal 工具跟踪；多文件并行审计用 workflow。
- 开发阶段不偏离看板卡范围；新冒出的工作先拆卡再排期，不顺手塞进当前卡。
