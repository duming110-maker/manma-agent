import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./globals.css";

/**
 * BC Agent 用户端前端 —— Vite 入口
 *
 * 变更记录：
 * - 2026-07-10 | 从 Next.js（app/layout.tsx + app/page.tsx）迁移到 Vite（main.tsx 挂载到 #root）
 *
 * 说明：
 * - 原 Next.js 的根布局（html/body 结构、metadata 标题）已迁移到根目录 index.html。
 * - 全局样式 globals.css 在此引入；StrictMode 与 Next.js 开发模式默认行为一致。
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
