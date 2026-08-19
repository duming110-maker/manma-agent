# BC Agent reference 同步

用途：更新 `reference/`（只读资料镜像）。

## 何时用

- 同事说「拉一下最新上游看看」。
- 需要核对上游新契约（读 docs/、packages/*/AGENTS.md）。

## 怎么做

1. `pnpm run sync:reference`（按 `upstream.json` 钉住的分支/SHA 更新）。
2. 脚本自动更新 `upstream.json` 的 fetchedAt + sha。

## 红线

- **同步 reference ≠ 升级依赖**。升级 = 改 `package.json` 版本 + 跑冒烟 + 更新 `upstream.json` 的 verifiedVersion/smokeResult。
- 不改 `reference/` 内任何文件（只读）。
- `reference/` 不进 git（.gitignore），开源发布不暴露。
