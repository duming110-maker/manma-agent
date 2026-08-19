import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

/**
 * BC Agent 用户端前端 —— Vite 配置
 *
 * 变更记录：
 * - 2026-07-10 | 从 Next.js 迁移到 Vite SPA
 *
 * 说明：
 * - @ 别名指向 ./src（与 tsconfig.json 的 paths 保持一致），源码中 @/components 等照常可用。
 * - 开发端口沿用 3000（与原 Next.js 一致，便于习惯）。
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 3000,
  },
});
