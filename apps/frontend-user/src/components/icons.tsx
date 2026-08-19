/**
 * BC Agent 自定义 SVG 图标组件集合
 *
 * 变更记录：
 * - 2026-07-03 | 初始化图标组件，涵盖导航菜单、工具栏、通用操作
 *
 * 设计说明：
 * - 全部采用内联 SVG，避免额外依赖图标库
 * - 统一 16px 基准尺寸，支持 size 属性灵活调整
 * - 图标风格：线性/轮廓风格，与 demo/ai_agent 参考一致
 * - 使用 currentColor 继承父级文字颜色
 */

import React from "react";

/** 图标组件通用属性 */
interface IconProps {
  /** 图标尺寸（px），默认 16 */
  size?: number;
  /** 额外 CSS 类名 */
  className?: string;
}

/* ================================================================
 *  导航菜单图标
 * ================================================================ */

/**
 * 新建任务图标 —— 编辑/书写风格（方框 + 笔）
 * 语义：创建新内容，开始新任务
 */
export const NewTaskIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path d="M11 1.99882C11.5522 1.99882 11.9999 2.44659 12 2.99882C12 3.5511 11.5523 3.99882 11 3.99882C9.58364 3.99882 8.58138 3.99928 7.79785 4.06327C7.02597 4.12634 6.5539 4.2457 6.18359 4.43436C5.43112 4.81782 4.81902 5.42995 4.43555 6.18241C4.24687 6.5527 4.12752 7.02482 4.06445 7.79667C4.00047 8.58018 4 9.58251 4 10.9988V11.9988C4 13.8959 4.00112 15.2389 4.11328 16.2742C4.22343 17.2906 4.43078 17.8922 4.76367 18.3504C5.01032 18.6898 5.309 18.9885 5.64844 19.2351C6.10667 19.5681 6.70818 19.7754 7.72461 19.8855C8.75997 19.9977 10.1029 19.9988 12 19.9988H13C14.4164 19.9988 15.4186 19.9984 16.2021 19.9344C16.9741 19.8713 17.4461 19.752 17.8164 19.5633C18.5689 19.1798 19.181 18.5677 19.5645 17.8152C19.7531 17.4449 19.8725 16.9728 19.9355 16.201C19.9995 15.4175 20 14.4151 20 12.9988C20.0001 12.4466 20.4478 11.9988 21 11.9988C21.5522 11.9988 21.9999 12.4466 22 12.9988C22 14.3823 22.0009 15.4802 21.9287 16.3641C21.8555 17.2596 21.7019 18.0233 21.3457 18.7225C20.7705 19.8514 19.8526 20.7693 18.7236 21.3445C18.0244 21.7008 17.2608 21.8544 16.3652 21.9275C15.4813 21.9997 14.3835 21.9988 13 21.9988H12C10.1475 21.9988 8.67782 22.0003 7.50977 21.8738C6.32316 21.7453 5.32958 21.475 4.47363 20.8533C3.96429 20.4832 3.51557 20.0345 3.14551 19.5252C2.52381 18.6693 2.25356 17.6756 2.125 16.4891C1.99848 15.321 2 13.8512 2 11.9988V10.9988C2 9.61535 1.99909 8.51745 2.07129 7.63358C2.14446 6.73808 2.29807 5.97437 2.6543 5.27518C3.22954 4.14626 4.14743 3.22834 5.27637 2.65311C5.97557 2.29689 6.73923 2.14327 7.63477 2.07011C8.51866 1.9979 9.61648 1.99882 11 1.99882ZM17.0459 2.70683C18.2174 1.53524 20.1174 1.53521 21.2891 2.70683C22.4598 3.87818 22.4598 5.77752 21.2891 6.94901L13.8271 14.4139C13.482 14.7592 13.2298 15.0167 12.9346 15.2254C12.6866 15.4005 12.4187 15.5472 12.1377 15.6619C11.8029 15.7986 11.4497 15.8732 10.9727 15.9783L9.9375 16.2068C9.75332 16.2474 9.54843 16.293 9.37305 16.3152C9.19723 16.3375 8.9042 16.3588 8.59375 16.2332C8.21725 16.0808 7.91905 15.7815 7.7666 15.4051C7.64121 15.0951 7.66139 14.8026 7.68359 14.6267C7.70579 14.4513 7.75139 14.2456 7.79199 14.0613L8.02149 13.0242C8.12639 12.5482 8.20065 12.1964 8.33692 11.8621C8.45152 11.5812 8.59848 11.3131 8.77344 11.0652C8.98179 10.7702 9.23812 10.5177 9.58301 10.1726L17.0459 2.70683ZM19.875 4.12089C19.4844 3.73029 18.8505 3.73117 18.46 4.12186L10.9971 11.5867C10.6059 11.9781 10.4944 12.0952 10.4072 12.2185C10.3199 12.3423 10.2457 12.4757 10.1885 12.616C10.1314 12.756 10.0939 12.9138 9.97461 13.4549L9.8125 14.1853L10.542 14.0252C11.084 13.9057 11.2417 13.8666 11.3818 13.8094C11.5222 13.752 11.6564 13.68 11.7803 13.5926C11.9038 13.5053 12.0203 13.3928 12.4121 13.0008L19.875 5.53495C20.2649 5.14455 20.2648 4.5113 19.875 4.12089Z" />
  </svg>
);

/**
 * 技能图标 —— 书本风格
 * 语义：技能模块，可安装的能力组件
 */
export const SkillsIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 13 13"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <g clipPath="url(#clip-skills)">
      <path d="M11.6611 12.7705H8.9375V11.917H11.6611V12.7705ZM4.87598 2.62695C5.52882 2.62709 6.11259 2.92328 6.5 3.38867C6.8875 2.92287 7.47271 2.62695 8.12598 2.62695H12.4053V7.36035H11.4297V3.60156H8.12598C7.49782 3.60156 6.9884 4.11113 6.98828 4.73926V10.5439C7.10856 10.4669 7.23685 10.4013 7.37207 10.3496L7.82715 10.1748L8.1748 11.0859L7.71973 11.2598C7.2913 11.4235 6.98851 11.838 6.98828 12.3223H6.0127L6.00684 12.207C5.94869 11.6335 5.4648 11.1858 4.87598 11.1855H0.59668V2.62695H4.87598ZM12.917 10.874H8.9375V10.0205H12.917V10.874ZM1.57129 10.21H4.87598C5.29481 10.21 5.68437 10.3336 6.0127 10.5439V4.73926C6.01258 4.11128 5.50392 3.6018 4.87598 3.60156H1.57129V10.21ZM12.917 8.97852H8.9375V8.125H12.917V8.97852Z" />
    </g>
    <defs>
      <clipPath id="clip-skills">
        <path d="M0 0H13V13H0z" />
      </clipPath>
    </defs>
  </svg>
);

/**
 * 定时任务图标 —— 闹钟/时钟风格
 * 语义：定时触发、自动化执行
 */
export const CronIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="13" r="8" />
    <path d="M12 9v4l2.5 2.5" />
    <path d="M5.5 3.5l-3 3" />
    <path d="M18.5 3.5l3 3" />
    <path d="M6 1h12" />
  </svg>
);

/**
 * 库图标 —— 文件夹/收藏风格
 * 语义：文件存储、AI 产出归集
 */
export const LibraryIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" />
    <path d="M2 9h20" />
    <path d="M8 13v4" />
    <path d="M12 13v2" />
    <path d="M16 13v3" />
  </svg>
);

/* ================================================================
 *  工具栏图标
 * ================================================================ */

/**
 * 文件夹图标 —— 工作事项选择
 */
export const FolderIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" />
  </svg>
);

/**
 * 拼图图标 —— 技能选择器（线性风格）
 */
export const PuzzleIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 01-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 10-3.214 3.214c.446.166.855.497.925.968a.979.979 0 01-.276.837l-1.61 1.611a2.404 2.404 0 01-1.705.706 2.404 2.404 0 01-1.704-.706l-1.568-1.568a1.026 1.026 0 00-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 11-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 00-.289-.877l-1.568-1.568A2.404 2.404 0 011.001 12a2.404 2.404 0 01.706-1.704l1.611-1.611a.98.98 0 01.837-.276c.47.07.802.48.968.925a2.501 2.501 0 103.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 01.276-.837l1.61-1.611a2.404 2.404 0 011.705-.706 2.404 2.404 0 011.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 113.237 3.237c-.464.18-.894.527-.967 1.02z" />
  </svg>
);

/**
 * 附件图标 —— 回形针
 */
export const AttachmentIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
  </svg>
);

/**
 * 发送图标 —— 箭头
 */
export const SendIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 2L11 13" />
    <path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
);

/* ================================================================
 *  通用操作图标
 * ================================================================ */

/**
 * 左箭头 —— 折叠指示器
 */
export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

/**
 * 右箭头 —— 展开指示器
 */
export const ChevronRightIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

/**
 * 下箭头 —— 下拉指示器
 */
export const ChevronDownIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

/**
 * 三点菜单图标 —— 更多操作
 */
export const MoreIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="19" cy="12" r="2" />
  </svg>
);

/**
 * 加号图标 —— 新建/添加
 */
export const PlusIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * 用户头像图标 —— 默认头像占位
 */
export const UserIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

/**
 * 搜索图标
 */
export const SearchIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

/**
 * 太阳图标 —— 亮色模式
 */
export const SunIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

/**
 * 月亮图标 —— 暗色模式
 */
export const MoonIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);

/**
 * 退出登录图标
 */
export const LogoutIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

/**
 * 书本文档图标 —— 知识库
 */
export const BookIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
  </svg>
);

/**
 * 列表图标 —— 规则管理
 */
export const ListIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

/**
 * 大脑/记忆图标 —— 记忆管理
 */
export const BrainIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 6a3.5 3.5 0 00-3.5-3.5A3.5 3.5 0 005 6c0 1.5.5 2.5 1 3.5" />
    <path d="M12 6a3.5 3.5 0 013.5-3.5A3.5 3.5 0 0119 6c0 1.5-.5 2.5-1 3.5" />
    <path d="M5 10c-1 0-2 .5-2 1.5S4 13 5 13" />
    <path d="M19 10c1 0 2 .5 2 1.5S20 13 19 13" />
    <path d="M5 13c0 2 .8 3.5 2 4.5" />
    <path d="M17 13c0 2-.8 3.5-2 4.5" />
    <path d="M7 18c-1 1-1.5 2.5-1 3.5h12c.5-1 0-2.5-1-3.5" />
    <path d="M9 10v3M15 10v3" />
  </svg>
);

/**
 * 设置图标
 */
export const SettingsIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

/* ================================================================
 *  文件类型图标（2026-07-13 新增，替代彩色 emoji，统一黑白线性风格）
 * ================================================================ */

/**
 * 图片图标 —— 替代 🖼️ / 📷 emoji
 * 语义：图片文件、图像预览
 */
export const ImageIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

/**
 * 表格/电子表格图标 —— 替代 📊 emoji
 * 语义：Excel、CSV、数据表格文件
 */
export const SpreadsheetIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
);

/**
 * 代码图标 —— 替代 💻 emoji
 * 语义：代码文件、脚本
 */
export const CodeIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

/**
 * 实心星星图标 —— 替代 ⭐ emoji（收藏/已收藏状态）
 * 语义：收藏、重要标记
 */
export const StarFilledIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="none">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

/**
 * 空心星星图标 —— 替代 ☆（未收藏状态）
 * 语义：可收藏、非重要
 */
export const StarIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

/**
 * 打开文件夹图标 —— 替代 📂 emoji
 * 语义：展开的文件夹、更多文件
 */
export const FolderOpenIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v2" />
    <path d="M2 10h20l-1.5 9H3.5L2 10z" />
  </svg>
);

/* ================================================================
 *  上传与文件图标（2026-07-10 新增）
 * ================================================================ */

/**
 * 上传图标（云上传箭头）
 * 用于技能上传入口、知识库文件上传等。
 */
export const UploadIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/**
 * 文件图标
 * 用于文件上传区域、文件类型标识等。
 */
export const FileIcon: React.FC<IconProps> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
