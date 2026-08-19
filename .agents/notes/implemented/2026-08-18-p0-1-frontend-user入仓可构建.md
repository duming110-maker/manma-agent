# 2026-08-18 · P0-1：frontend-user 入仓为可构建 workspace 成员

## 决策

frontend-user（UI 移植来源）以**产品副本**形式落在 `apps/frontend-user/`，来源是只读镜像 `reference/demo/frontend-user`（tar 拷贝排除 `node_modules/`、`dist/`、`.next/`、`package-lock.json/`）。镜像仍是权威参照，apps 副本是为 P0 spike 可构建、P2 移植（`packages/web-ui`）的过渡工作面。

包 `name` 为裸名 `frontend-user`（镜像原名 `bc-agent-frontend-user`）：验收命令 `pnpm --filter frontend-user build` 依赖包名**精确匹配**——pnpm 11.7 实测不匹配目录名（PM 在临时 workspace 验证，filter 无 glob 时只对 name 精确匹配）。包名是代码标识符，非品牌字符串，不违铁律 5。

`apps/frontend-user/package.json` 补 `"type": "module"`：ESM-only 铁律的配套，且无它则 Node 对 `eslint.config.js` 报 MODULE_TYPELESS_PACKAGE_JSON。lint 工具链为 ESLint 9 flat config（Vite react-ts 模板），`eslint-plugin-react-hooks` 钉 `^5.2.0`——v7 recommended 新增 16 条规则（`set-state-in-effect` 等）对本副本源码报 4 个只能重构消除的 error，与"机械修复"边界冲突，待 P2 移植时随重构再升。

`pnpm-workspace.yaml` 的 `allowBuilds: esbuild: true`：pnpm 11 首次 install 自动写入占位，esbuild postinstall 拉取 vite 所需平台二进制，必需且无外传风险，PM 追认。

评审（独立子 agent）verdict 通过；其对 `.nvmrc`（内容 "20"，与根 engines `^22.19 || >=24` 冲突，nvm/fnm 用户会被切错 node）的异议被采纳：删除 `apps/frontend-user/.nvmrc`，node 版本由根 `package.json` engines 统一治理。

## 接受的残留（有意不动）

- 2 条 `react-hooks/exhaustive-deps` warning（LibraryPage.tsx:432 缺 `fileGroups`、Sidebar.tsx:187 缺 `resetForm`）：补依赖即改行为，越机械修复界，留 P2 移植时处理。
- `apps/frontend-user/.npmrc`（`legacy-peer-deps=true`）：npm 专用，pnpm 完全忽略；保持镜像一致，P2 移植不带走。
- 依赖 caret 漂移（react 19.2.8 / tailwind 4.3.3 / @base-ui/react 1.7.0 vs 镜像 19.2.7/4.3.2/1.6.0）：build/typecheck/lint 全过，`pnpm-lock.yaml` 锁定、frozen install 可复现。@base-ui 1.6→1.7 的**运行时**行为差异未被静态门禁覆盖，留给 P0-2/P2 页面冒烟观察。
- `eslint.config.js` 的 `globalIgnores(["dist"])` 未含 `.next`（本副本是 Vite，无该目录）。

## 验证

PM 与评审各自独立重跑（退出码全 0）：`pnpm --filter frontend-user build`（dist js 416.39 kB / css 38.66 kB）、`typecheck`、`lint`（0 error / 2 warning）、根聚合 `pnpm run typecheck` / `pnpm run lint`；`diff -r` 证实 `reference/` 零改动、apps 侧仅 package.json / SearchableMultiSelect.tsx（删未用 `toggleOption` 死代码）两处 diff + 新文件 `eslint.config.js`；`pnpm install --frozen-lockfile` 通过。删 `.nvmrc` 后 build/lint 复跑仍全过。
