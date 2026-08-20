# 06 技能编写标准（SKILL.md）

- 版本：v1.0（2026-08-19）
- 上级文档：[README.md](README.md)；规格出处：[04-spec.md §3.3](04-spec.md)（F3 技能）
- 适用范围：本仓库 `.agents/skills/*`、工作区 `<工作区根>/.agents/skills/*`、全局 `~/.dsh/skills` 的全部技能

本仓库所有技能的 SKILL.md 必须符合本标准。标准 = **dsh 上游契约**（机器可读）+ **skill-creator 写法**（模型可触发）+ **bc 应用字段**（页面可展示）。

## 1. 目录形态

```
skill-name/               # 目录名 = kebab-case：^[a-z0-9]+(?:-[a-z0-9]+)*$
├── SKILL.md              # 必填；YAML frontmatter + Markdown 正文（<500 行）
├── scripts/              # 可选：确定性/重复性任务的脚本
├── references/           # 可选：按需加载的参考文档（>300 行需带目录）
└── assets/               # 可选：产物模板、图标等
```

**上游限制**：dsh 本地提供方不支持嵌套递归的 `**/SKILL.md` 发现——一个技能目录只认一层 `SKILL.md`。

## 2. frontmatter 字段

```yaml
---
name: skill-name           # 必填，kebab-case，与目录名一致
description: 一句话或块   # 必填，触发机制，写法见 §3
whenToUse: 额外触发指引   # 可选，bc 应用「已安装」页展示用
disable-model-invocation: false  # 可选，true = 模型目录不出现该技能（默认 false）
user-invocable: true      # 可选，false = /name 手势不触发（默认 true）
---
```

| 字段 | 必填 | 读取方 | 说明 |
|---|---|---|---|
| `name` | ✅ | dsh 注册表 / bc 应用 | kebab-case；模型经 `/name` 手势寻址 |
| `description` | ✅ | dsh 注册表（模型路由） / bc 应用 | 模型判断是否触发的唯一依据 |
| `whenToUse` | 可选 | bc 应用（`skills.list` 展示） | 额外路由指引 |
| `disable-model-invocation` | 可选 | dsh 本地提供方 | true 时仅供用户调用 |
| `user-invocable` | 可选 | dsh 本地提供方 | false 时仅供模型调用 |

**缺 frontmatter 的后果**：bc 应用把 `name` 回退为目录名、`description` 显示为空；模型无法路由。安装校验（看板 P3b-1）会拒绝。

## 3. description 写法（触发机制）

- 说清「做什么」**和**「什么时候用」；模型有欠触发倾向，描述可**略 pushy**（skill-creator 原则）。
- 包含触发场景关键词与边界（何时不该用）；一行可读，<100 词。
- 例（bc-agent-pm）：

  > 项目管理工作流。当需要从 docs/任务看板.md 推进开发任务时使用——派开发子代理、独立验收、派评审、驱动返工循环；也用于把长任务拆卡、判定卡状态。

## 4. 正文写法

- 祈使句；解释「为什么」优于堆砌 MUST/ALWAYS（skill-creator 原则：生硬约束是黄旗）。
- <500 行；接近上限时把细节下沉到 `references/` 并给出读取指针。
- 输出格式给「必须的模板」；交互示例用 Input/Output 对。
- 渐进披露：SKILL.md 只放触发即需的内容；脚本/参考按需加载。

## 5. 校验与出处

- 上游契约出处：`reference/upstream/docs/subsystems/skills.zh.md`、`reference/upstream/packages/skill/*/README*`。
- 写法范本：`.agents/skills/skill-creator/SKILL.md`（带 frontmatter + 分层资源的标准示例）。
- 评审（`.agents/skills/bc-agent-code-review`）与推送前检查（`.agents/skills/bc-agent-pre-push-checks`）按本标准核对技能改动。
- 应用安装校验（capability-core `skills.install`）落地后按 §2 执行。

## 6. 技能市场清单（skills-market.json）

技能市场 = 一份清单文件 + 按清单从 GitHub 拉取安装。清单是**配置标准**，随 capability-core 构建进产物（`packages/capability-core/market/skills-market.json` → `lib/skills-market.json`），开发者/用户可自行增删条目；后期可改为远程 URL 托管。

```json
{
  "version": 1,
  "skills": [
    {
      "id": "docx",
      "name": "docx",
      "description": "创建/编辑 Word 文档",
      "whenToUse": "需要生成 .docx 时",
      "source": {
        "type": "github",
        "repo": "anthropics/skills",
        "ref": "main",
        "path": "document-skills/docx"
      },
      "tags": ["document", "office"],
      "license": "MIT"
    }
  ]
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `version` | ✅ | 清单格式版本（当前 1） |
| `skills[].id` | ✅ | kebab-case 唯一标识，安装后作为技能目录名 |
| `skills[].name` | ✅ | 技能名（应与 SKILL.md frontmatter 的 name 一致） |
| `skills[].description` | ✅ | 市场展示用短描述（安装时以 SKILL.md frontmatter 为准） |
| `skills[].whenToUse` | 可选 | 市场展示用触发指引 |
| `skills[].source.type` | ✅ | 当前仅支持 `github` |
| `skills[].source.repo` | ✅ | `owner/repo` |
| `skills[].source.ref` | ✅ | 分支/tag/commit（默认分支名） |
| `skills[].source.path` | ✅ | 技能目录在仓库内的路径 |
| `skills[].tags` | 可选 | 市场分类标签 |
| `skills[].license` | 可选 | 技能仓库 License（安装前向用户展示） |

**安装流程**（capability-core `skills.market.install`）：按 `source` 用 GitHub API 拉取技能目录文件 → 校验 SKILL.md frontmatter（§2）→ 用户选择安装位置（全局 or 工作区 `.agents/skills`）→ 落盘。拉取失败/无 frontmatter 均报错且不落盘。

**新增市场条目**：找到目标技能目录（含标准 SKILL.md）→ 按上表追加一条 → 构建后重启应用即可在市场看到。建议优先收录 License 宽松、维护活跃的开源技能。
