# packages/

`@bc-agent/*` 插件包（pnpm workspace 成员）。

| 包 | 职责 | 期 |
|---|---|---|
| shell | bc-desktop-shell：Electron 侧 Host 插件 | P1 |
| web-ui | bc-web-ui：客户端布局插件（frontend-user 移植目标） | P0/P2 |
| capability-core | /ext 通道框架 + 备份恢复 + 自有 SQLite 基建 | P3 |
| capability-workspace | 工作区薄层（首次启动强制选工作区 + 扩展元数据） | P3 |
| capability-cron | 定时任务（cron-parser 调度 + 执行记录） | P4 |
| capability-skillx | 技能管理流 | P3b |
| capability-krm | 规则 + 记忆（存储 + system-prompt 注入） | P3a |

详细设计见 [docs/03-architecture.md §3](../docs/03-architecture.md)。
