/**
 * BC Agent 用户端前端 —— PostCSS 配置
 *
 * 变更记录：2026-07-10 | 初始化（Tailwind v4 接入，对齐 frontend-admin）
 *
 * 说明：Tailwind v4 仅需 @tailwindcss/postcss 这一个插件；主题令牌全部
 * 自包含在 app/globals.css 的 @theme inline 中，无需在此重复声明。
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
