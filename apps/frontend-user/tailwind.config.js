/**
 * BC Agent 用户端前端 —— Tailwind 配置
 *
 * 变更记录：
 * - 2026-07-10 | 初始化（Tailwind v4，CSS-first）
 * - 2026-07-10 | 迁移到 Vite src 结构：content 路径调整为 ./index.html 与 ./src/**
 *
 * 说明：
 * - Tailwind v4 是 CSS-first：主题令牌已自包含在 src/globals.css 的 @theme inline，无需 theme 键。
 * - v4 默认开启"自动源检测"，此处保留显式 content 仅为确定性参考。
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
  ],
};
