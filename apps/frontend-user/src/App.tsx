"use client";

/**
 * BC Agent 首页 —— 左侧导航 + 右侧路由出口 + 搜索弹窗
 *
 * 变更记录：
 * - 2026-07-03 | 初始化首页布局：侧栏(300px) + 会话页(flex-1)（demo 原版）
 * - 2026-07-10 | 从 Next.js 迁移到 Vite
 * - 2026-07-10 | 引入 React Router v7：主导航 / 设置 / 会话均使用真实 URL，
 *               替换原 activeNav 状态切换 + ?nav= 方案（现可深链接、刷新保持、前进后退）
 *
 * 路由表（真实页面 URL）：
 *   /            → 新建任务（欢迎页）
 *   /chat/:id    → 会话详情（可深链接、刷新保持、前进后退）
 *   /skills      → 技能
 *   /cron        → 定时任务
 *   /library     → 库
 *   /settings    → 设置（全屏覆盖，原为弹窗）
 *
 * 设计说明：
 * - Sidebar 保持原有回调接口不变（onNavChange / onConversationSelect / onOpenSettings），
 *   本组件把这些回调翻译为路由跳转（navigate），并从当前 URL 反推 activeNav 用于侧栏高亮。
 *   这样路由化对 Sidebar 零改动，最大限度降低风险。
 * - 工作区（Workspace）接管会话状态：根据 URL 是否含 conversationId 决定显示欢迎页或会话历史。
 */

import ConversationPage from "@/components/ConversationPage";
import CronPage from "@/components/CronPage";
import LibraryPage from "@/components/LibraryPage";
import SettingsPage from "@/components/SettingsPage";
import type { NavKey } from "@/components/Sidebar";
import Sidebar from "@/components/Sidebar";
import SkillsPage from "@/components/SkillsPage";
import { SearchIcon } from "@/components/icons";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";

/** 主导航项 NavKey → 路由路径映射 */
const NAV_ROUTE: Record<NavKey, string> = {
  "new-task": "/",
  agent: "/skills",
  cron: "/cron",
  library: "/library",
};

/** 会话消息类型（与 ConversationPage 保持一致） */
interface DemoMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/** 演示用的会话历史（mock） */
const DEMO_HISTORY: Omit<DemoMessage, "timestamp">[] = [
  {
    id: "demo-1",
    role: "user",
    content: "帮我分析一下这个客户的还款记录，看看最近三个月是否有异常",
  },
  {
    id: "demo-2",
    role: "assistant",
    content:
      "好的，根据分析结果，该客户在近三个月内的还款情况如下：\n\n• 4月：按时还款，无逾期\n• 5月：延迟3天还款，已补缴滞纳金\n• 6月：目前处于逾期状态（已超过5天）\n\n建议尽快联系客户了解情况，可能存在资金周转问题。需要我帮你生成催收话术吗？",
  },
];

/**
 * 根据会话 id 前缀推断展示标题（演示用）：
 * conv- 开头为工作事项会话，其余（free-/search- 等）为自由会话。
 */
function conversationTitleOf(id: string): string {
  return id.startsWith("conv-") ? "工作事项会话" : "自由会话";
}

/**
 * 工作区：同时承载 "/"（欢迎页）与 "/chat/:conversationId"（会话详情）。
 * 通过 useParams 读取会话 id；存在则加载演示历史，不存在则展示欢迎页。
 */
function Workspace() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<DemoMessage[]>([]);

  // 会话 id 变化时加载/清空演示历史
  useEffect(() => {
    if (conversationId) {
      const now = new Date().toISOString();
      setMessages(DEMO_HISTORY.map((m) => ({ ...m, timestamp: now })));
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  /** 发送消息：追加用户消息，并模拟 AI 延迟回复 */
  const handleSend = useCallback((content: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content, timestamp: new Date().toISOString() },
    ]);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: "收到你的消息。这是一个演示回复，实际使用时会对接 AI 后端进行智能回答。",
          timestamp: new Date().toISOString(),
        },
      ]);
    }, 1200);
  }, []);

  /** 返回欢迎页 */
  const handleBackToWelcome = useCallback(() => navigate("/"), [navigate]);

  return (
    <ConversationPage
      messages={messages}
      onSend={handleSend}
      activeConversationTitle={conversationId ? conversationTitleOf(conversationId) : ""}
      onBackToWelcome={handleBackToWelcome}
    />
  );
}

/**
 * 应用主体（须位于 <BrowserRouter> 内部，才能使用 useNavigate / useLocation 等 hook）。
 * 负责：侧栏、路由出口、搜索弹窗、全局主题。
 */
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();

  /* 主题（从 localStorage 恢复，应用到 <html>） */
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    return (localStorage.getItem("bc-agent-theme") as "light" | "dark") || "light";
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("bc-agent-theme", theme);
  }, [theme]);

  /* 侧栏折叠 & 搜索弹窗 */
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  /* 由当前 URL 反推侧栏高亮（路由驱动） */
  const activeNav: NavKey = useMemo(() => {
    if (location.pathname.startsWith("/skills")) return "agent";
    if (location.pathname.startsWith("/cron")) return "cron";
    if (location.pathname.startsWith("/library")) return "library";
    return "new-task"; // / 、/chat/* 、/settings 均归到“新建任务”高亮
  }, [location.pathname]);

  /* 当前会话 id（用于侧栏会话项高亮） */
  const activeConversationId = location.pathname.startsWith("/chat/")
    ? decodeURIComponent(location.pathname.slice("/chat/".length))
    : undefined;

  /* —— 把侧栏回调翻译为路由跳转 —— */
  const handleNavChange = useCallback(
    (key: NavKey) => {
      navigate(NAV_ROUTE[key]);
    },
    [navigate]
  );

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      navigate(`/chat/${encodeURIComponent(conversationId)}`);
    },
    [navigate]
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* ===== 左侧导航栏 ===== */}
      <Sidebar
        activeNav={activeNav}
        onNavChange={handleNavChange}
        activeConversationId={activeConversationId}
        onConversationSelect={handleConversationSelect}
        collapsed={sidebarCollapsed}
        onSearchClick={() => setSearchOpen(true)}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenSettings={() => navigate("/settings")}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
      />

      {/* ===== 右侧主内容区（路由出口） ===== */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/chat/:conversationId" element={<Workspace />} />
          <Route path="/skills" element={<SkillsPage onUseSkill={() => navigate("/")} />} />
          <Route path="/cron" element={<CronPage onNavigateToChat={() => navigate("/")} />} />
          <Route path="/library" element={<LibraryPage />} />
          {/* 设置：全屏覆盖组件，作为路由渲染时视觉与原弹窗一致；✕ 返回上一页 */}
          <Route path="/settings" element={<SettingsPage onClose={() => navigate(-1)} />} />
          {/* 未匹配路由统一回首页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* ===== 搜索弹窗（全局覆盖层，任意页面可用） ===== */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.3)" }}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-[520px] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-main)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 搜索输入区 */}
            <div
              className="flex items-center gap-[10px] border-b-[0.5px] px-[16px] py-[14px]"
              style={{ borderColor: "var(--border-main)" }}
            >
              <span className="text-[var(--text-muted)]">
                <SearchIcon size={18} />
              </span>
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索会话..."
                className="flex-1 border-none bg-transparent text-[15px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchOpen(false);
                }}
              />
              <button
                onClick={() => setSearchOpen(false)}
                className="rounded-[6px] border-none bg-transparent px-[8px] py-[4px] text-[12px] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--fill-tsp-white-light)]"
              >
                ESC
              </button>
            </div>

            {/* 搜索结果列表（模拟） */}
            <div className="max-h-[320px] overflow-y-auto px-[8px] py-[8px]">
              {[
                "关于催收策略的优化方案讨论",
                "逾期客户数据分析",
                "准入规则评审",
                "数据分析思路整理",
                "周报模板设计",
              ]
                .filter((t) => !searchQuery || t.includes(searchQuery))
                .map((title) => (
                  <div
                    key={title}
                    className="flex cursor-pointer items-center gap-[10px] rounded-[10px] px-[12px] py-[10px] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                      handleConversationSelect(`search-${title}`);
                    }}
                  >
                    <span
                      className="flex size-[28px] shrink-0 items-center justify-center rounded-[6px] text-[var(--text-muted)]"
                      style={{ backgroundColor: "var(--fill-tsp-white-light)" }}
                    >
                      <SearchIcon size={14} />
                    </span>
                    <span className="text-[14px] text-[var(--text-primary)]">{title}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 应用根：用 BrowserRouter 包裹，启用 HTML5 history 路由（干净 URL，如 /skills）。
 * 部署到静态服务器时需配置 SPA 回退（所有未知路径返回 index.html），开发期 Vite 已内置。
 */
export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
