# 角色提示词（开发 / 评审）

两个「固定子 agent」的角色定义。**按阶段升级 = 直接改这两个文件**（改动记一条 `.agents/notes/`）。

## 怎么用

- PM（主 agent）派活：把 `developer.md` + 任务卡 拼成开发子 agent 的 prompt。
- 开发完成后：把 `reviewer.md` + 开发产出 拼成评审子 agent 的 prompt。
- 会话内反复 `send_message` 同一子 agent，保留它的项目上下文。

## 升级约定

- 每个阶段（P0/P1/P2…）结束时，回顾这两个角色是否需要补规则 / 命令 / 清单，直接改文件 + 记 `.agents/notes/`。
- 角色文件要**自足**：新子 agent 无上下文，读它 + 任务卡就能开工。
