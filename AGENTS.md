# AGENTS.md — BC Agent Desktop

deepseek-harness（dsh）的插件化桌面外壳。**上游核心零修改**：所有定制以标准插件 + profile 叠加实现。

## 仓库布局

- 产品代码：`apps/`（Electron 壳）、`packages/`（`@bc-agent/*` 插件）、`profiles/`、`branding/`、`scripts/`。
- `reference/`：只读资料镜像（上游源码 + demo + 设计文档），git 忽略，经 `pnpm run sync:reference` 更新；**绝不 import、绝不改动、绝不提交**。
- `upstream.json`：钉住的上游 npm 版本 + reference SHA，升级必须更新它。
- `docs/`：设计规格（权威来源）。
- `.agents/notes/`：非平凡决策留痕。

## 铁律

1. **不改上游源码**（[docs/03-architecture.md G2](docs/03-architecture.md)）。
2. **上游触点单点**：前端官方调用收 `packages/web-ui/src/adapters/upstream.ts`；Host 插件只用文档化 `ctx.*`。
3. **锁版本 + 冒烟**：升级 = 改 `package.json` 版本 + 跑 S1–S10 冒烟 + 更新 `upstream.json`；同步 reference 不是升级。
4. **双语**：zh 为 key 集事实源，en 编译期校验平衡（`ctx.locale.register(ns, {zh,en})`）。
5. **品牌单源**：用户可见品牌字符串只经 `branding/`，代码禁止硬编码。
6. **数据不出本机**：loopback-only、凭证不落明文、工作文件落用户自选目录（不落 C 盘）。

## 命令

```sh
pnpm install
pnpm run typecheck
pnpm run test
pnpm run smoke          # 冒烟清单（待 P0 落地）
pnpm run sync:reference
```

## 权威约定

写插件时，dsh 的契约以 `reference/upstream/docs/` 与 `reference/upstream/packages/*/AGENTS.md` 为准。bc 不重复抄录，只链接：

- ESM only；`strict: true`；每次贡献走 `ctx.effect()`/`ctx.on()`，注册表 `register()` 返回 disposer。
- capability seam 三件套（Service Definition / Provider / Consumer）。
- 模型可见 ⟺ 落日志；closed union 用 `assertNever`。
- 无硬编码 tunable：部署可调项进 `Config`，从 cordis.yml 可改。
- 测试描述行为，不描述正确性。
- 文件末尾恰好一个换行。
