import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { globalIgnores } from "eslint/config";

/**
 * BC Agent 用户端前端 —— ESLint 9 flat config
 *
 * 变更记录：
 * - 2026-08-18 | 入仓 apps/frontend-user：按 Vite react-ts 模板接入 lint
 *
 * 说明：
 * - dist/ 为构建产物，不入 lint。
 * - 未用变量按 `_` 前缀豁免（与 TS 惯例一致）。
 * - src/components/ui/ 是 shadcn 生成代码，buttonVariants 与组件同文件
 *   导出是官方模式，关闭 only-export-components。
 */
export default tseslint.config([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/components/ui/**"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
]);
