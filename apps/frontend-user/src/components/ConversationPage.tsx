"use client";

/**
 * BC Agent 会话页面（新建任务模块）
 *
 * 变更记录：
 * - 2026-07-03 | 初始化会话页面（产品方案 V1.1）
 * - 2026-07-03 | 对齐 manus.im/app 暖灰色系
 * - 2026-07-03 | 欢迎页内容基于产品方案 doc/bcagent-product-proposal-v1.1.md
 * - 2026-07-03 | 增大输入框高度，增加 mock 演示交互
 *
 * 欢迎页内容（来自产品方案）：
 * - 标题：欢迎使用 BC Agent
 * - 副标题：输入你的需求，AI 帮你完成
 * - 快捷入口：4 个卡片，hover 时边框高亮 + 微上浮
 *
 * 输入框规范（增大高度）：
 * - 默认最小高度 60px（原为单行自适应）
 * - 聚焦时边框加深 + 微阴影
 */

import {
  AttachmentIcon,
  ChevronDownIcon,
  CronIcon,
  FolderIcon,
  LibraryIcon,
  NewTaskIcon,
  SendIcon,
  SkillsIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";
import React, { useCallback, useEffect, useRef, useState } from "react";

/* ================================================================
 *  类型定义
 * ================================================================ */

type MessageRole = "user" | "assistant";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
}

interface ConversationPageProps {
  /** 外部传入的消息列表（用于会话切换演示） */
  messages?: Message[];
  /** 消息发送回调 */
  onSend?: (content: string) => void;
  /** 当前活跃会话标题（用于显示在上方） */
  activeConversationTitle?: string;
  /** 回到欢迎页回调 */
  onBackToWelcome?: () => void;
}

/* ================================================================
 *  常量
 * ================================================================ */

const MODELS = [
  "DeepSeek-V4-Flash",
  "DeepSeek-V4-Pro",
  "Claude-Opus-4.8",
  "通义千问-Max",
];

/** 已安装技能（模拟，对应技能页已安装的技能） */
const INSTALLED_SKILLS = [
  { name: "催收话术策略", source: "enterprise" },
  { name: "数据分析助手", source: "market" },
  { name: "贷后监控报告", source: "enterprise" },
  { name: "邮件智能起草", source: "market" },
];

/** 快捷入口卡片 —— 来自产品方案 V1.1 核心业务场景 */
const QUICK_ACTIONS = [
  {
    icon: <NewTaskIcon size={20} />,
    label: "智能催收",
    desc: "根据逾期阶段，生成专业催收话术",
  },
  {
    icon: <SkillsIcon size={20} />,
    label: "风控审批",
    desc: "自动检查准入条件，标记风险点",
  },
  {
    icon: <CronIcon size={20} />,
    label: "数据分析",
    desc: "分析业务数据，产出可视化报告",
  },
  {
    icon: <LibraryIcon size={20} />,
    label: "文档处理",
    desc: "上传文件，AI帮你整理与总结",
  },
];

/* ================================================================
 *  子组件
 * ================================================================ */

/**
 * 欢迎页 —— 居中品牌引导区
 *
 * 内容基于产品方案 V1.1 "新建任务" 章节：
 * - 首次使用时居中显示欢迎语和输入提示
 * - 4 个快捷功能卡片辅助用户快速开始
 */
const WelcomeScreen: React.FC<{ onQuickAction?: (label: string) => void }> = ({
  onQuickAction,
}) => (
  <div className="flex flex-1 flex-col items-center justify-center px-6">
    <div className="w-full max-w-[600px] text-center">
      {/* 主标题 */}
      <h1 className="m-0 text-[28px] font-bold leading-[36px] text-[var(--text-primary)]">
        欢迎使用 BC Agent
      </h1>

      {/* 副标题 */}
      <p className="m-0 mt-3 text-[15px] leading-[22px] text-[var(--text-muted)]">
        输入你的需求，AI 帮你完成
      </p>

      {/* 快捷功能卡片：2×2 网格 */}
      <div className="mt-10 grid grid-cols-2 gap-3">
        {QUICK_ACTIONS.map((action) => (
          <div
            key={action.label}
            onClick={() => onQuickAction?.(action.label)}
            className="flex cursor-pointer items-start gap-3 rounded-[12px] border-[0.5px] p-4 text-left transition-all duration-200"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-main)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "var(--shadow-md)";
              e.currentTarget.style.borderColor = "var(--color-primary)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--border-main)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* 图标区 */}
            <span
              className="flex size-[40px] shrink-0 items-center justify-center rounded-[10px]"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
                color: "var(--color-primary)",
              }}
            >
              {action.icon}
            </span>

            {/* 文字区 */}
            <div className="flex flex-col gap-[2px]">
              <span className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)]">
                {action.label}
              </span>
              <span className="text-[12px] leading-[18px] text-[var(--text-muted)]">
                {action.desc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/**
 * 用户消息气泡
 */
const UserMessageBubble: React.FC<{ message: Message }> = ({ message }) => (
  <div className="mb-5 flex justify-end">
    <div
      className="w-3/4 rounded-[16px] rounded-br-[4px] px-4 py-3"
      style={{ backgroundColor: "var(--bg-nav)" }}
    >
      <p className="m-0 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--text-primary)]">
        {message.content}
      </p>
    </div>
  </div>
);

/**
 * AI 消息
 */
const AssistantMessageBubble: React.FC<{ message: Message }> = ({ message }) => (
  <div className="mb-5">
    <div className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[var(--text-primary)]">
      {message.content}
    </div>
  </div>
);

/**
 * 消息列表（含会话标题栏）
 */
const MessageList: React.FC<{
  messages: Message[];
  title?: string;
  onBack?: () => void;
}> = ({ messages, title, onBack }) => {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 会话标题栏（点击回到欢迎页） */}
      {title && (
        <div
          className="flex shrink-0 cursor-pointer items-center gap-[8px] border-b-[0.5px] px-6 py-3 transition-colors hover:bg-[var(--fill-tsp-white-light)]"
          style={{ borderColor: "var(--border-main)" }}
          onClick={onBack}
          title="点击回到欢迎页"
        >
          <span className="text-[var(--text-muted)]">
            <ChevronDownIcon size={14} className="rotate-90" />
          </span>
          <span className="text-[14px] font-medium text-[var(--text-primary)]">
            {title}
          </span>
        </div>
      )}

      {/* 消息滚动区 */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-6 py-4"
        aria-label="消息列表"
      >
        <div className="mx-auto max-w-[800px]">
          {messages.map((msg) =>
            msg.role === "user" ? (
              <UserMessageBubble key={msg.id} message={msg} />
            ) : (
              <AssistantMessageBubble key={msg.id} message={msg} />
            )
          )}
        </div>
      </div>
    </div>
  );
};

/* ================================================================
 *  主组件
 * ================================================================ */

const ConversationPage: React.FC<ConversationPageProps> = ({
  messages = [],
  onSend,
  activeConversationTitle,
  onBackToWelcome,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasMessages = messages.length > 0;

  /* ---- 发送消息 ---- */
  const handleSend = useCallback(() => {
    const content = inputValue.trim();
    if (!content) return;
    onSend?.(content);
    setInputValue("");
    // 重置输入框高度
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  }, [inputValue, onSend]);

  /* ---- 键盘 ---- */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  /* ---- 自适应高度（最小 60px） ---- */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputValue(e.target.value);
      const el = e.target;
      el.style.height = "auto";
      el.style.height = `${Math.max(60, Math.min(el.scrollHeight, 200))}px`;
    },
    []
  );

  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: "var(--bg-card)" }}
    >
      {/* ===== 消息区 / 欢迎页 ===== */}
      {hasMessages ? (
        <MessageList
          messages={messages}
          title={activeConversationTitle}
          onBack={onBackToWelcome}
        />
      ) : (
        <WelcomeScreen
          onQuickAction={(label) => {
            // 快捷入口点击：将技能名称以 /技能名 格式填入输入框
            const skillMap: Record<string, string> = {
              "智能催收": "催收话术策略",
              "风控审批": "风控审批辅助",
              "数据分析": "数据分析助手",
              "文档处理": "邮件智能起草",
            };
            const skillName = skillMap[label] || label;
            setInputValue(`/${skillName} `);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
        />
      )}

      {/* ===== 底部输入区 ===== */}
      <div className="shrink-0 px-6 pb-5">
        <div className="mx-auto max-w-[800px]">
          {/* 输入框容器 */}
          <div
            className="flex flex-col rounded-[16px] border p-4 transition-all duration-200 focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_4px_rgba(37,99,235,0.12),0_2px_8px_rgba(0,0,0,0.08)]"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-main)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {/* 多行输入 —— 技能以 /名称 内联在文本中 */}
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入你的需求..."
              rows={2}
              className="w-full min-h-[60px] resize-none border-none bg-transparent text-[15px] leading-relaxed text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              aria-label="输入消息内容"
            />

            {/* 底部工具栏 */}
            <div className="mt-3 flex items-center gap-1">
              {/* 工作事项选择下拉 */}
              <div className="relative">
                <button
                  type="button"
                  className="flex h-[30px] cursor-pointer items-center gap-1 rounded-[8px] border-none bg-transparent px-2 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
                  onClick={() => {
                    setShowProjectDropdown(!showProjectDropdown);
                    setShowSkillDropdown(false);
                    setShowModelDropdown(false);
                  }}
                >
                  <FolderIcon size={14} />
                  <span>{selectedProject || "选择工作事项(可选)"}</span>
                  <ChevronDownIcon size={10} />
                </button>

                {showProjectDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowProjectDropdown(false)} />
                    <div
                      className="absolute bottom-full left-0 z-20 mb-1 w-44 overflow-hidden rounded-[10px] border-[0.5px] py-1 shadow-md"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-main)",
                      }}
                    >
                      <div
                        onClick={() => { setSelectedProject(""); setShowProjectDropdown(false); }}
                        className={cn("cursor-pointer px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--fill-tsp-white-light)]", !selectedProject ? "text-[var(--color-primary)] font-medium" : "text-[var(--text-primary)]")}
                      >
                        不选择工作事项
                      </div>
                      <div className="mx-2 border-t-[0.5px]" style={{ borderColor: "var(--border-main)" }} />
                      {["催收工作事项", "风控分析"].map((proj) => (
                        <div
                          key={proj}
                          onClick={() => { setSelectedProject(proj); setShowProjectDropdown(false); }}
                          className={cn("flex cursor-pointer items-center gap-[6px] px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--fill-tsp-white-light)]", selectedProject === proj ? "text-[var(--color-primary)] font-medium" : "text-[var(--text-primary)]")}
                        >
                          <FolderIcon size={14} /> {proj}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 技能选择下拉 */}
              <div className="relative">
                <button
                  type="button"
                  className="flex h-[30px] cursor-pointer items-center gap-1 rounded-[8px] border-none bg-transparent px-2 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
                  onClick={() => {
                    setShowSkillDropdown(!showSkillDropdown);
                    setShowProjectDropdown(false);
                    setShowModelDropdown(false);
                  }}
                >
                  <SkillsIcon size={14} />
                  <span>技能</span>
                  <ChevronDownIcon size={10} />
                </button>

                {showSkillDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSkillDropdown(false)} />
                    <div
                      className="absolute bottom-full left-0 z-20 mb-1 w-48 overflow-hidden rounded-[10px] border-[0.5px] py-1 shadow-md"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-main)",
                      }}
                    >
                      <div className="px-3 py-1 text-[11px] font-medium text-[var(--text-tertiary)]">已安装技能</div>
                      {INSTALLED_SKILLS.map((skill) => {
                        const isActive = inputValue.includes(`/${skill.name}`);
                        return (
                          <div
                            key={skill.name}
                            onClick={() => {
                              if (isActive) {
                                // 移除技能：从输入框中删除 /技能名
                                setInputValue((prev) => prev.replace(new RegExp(`/${skill.name}\\s*`, "g"), "").trimEnd());
                              } else {
                                // 添加技能：在输入框末尾追加 /技能名
                                setInputValue((prev) => {
                                  const trimmed = prev.trimEnd();
                                  return trimmed ? `${trimmed} /${skill.name} ` : `/${skill.name} `;
                                });
                                setTimeout(() => inputRef.current?.focus(), 50);
                              }
                              // 不关闭下拉，允许连续选择多个
                            }}
                            className={cn(
                              "flex cursor-pointer items-center justify-between px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--fill-tsp-white-light)]",
                              isActive ? "text-[var(--color-primary)] font-medium" : "text-[var(--text-primary)]"
                            )}
                          >
                            <span>{skill.name}</span>
                            <span className="text-[11px] text-[var(--text-tertiary)]">{isActive ? "已选" : skill.source === "enterprise" ? "企业" : "外部"}</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* 附件上传 */}
              <button
                type="button"
                className="flex size-[30px] cursor-pointer items-center justify-center rounded-[8px] border-none bg-transparent text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
                title="上传附件"
                onClick={() => alert("【演示】打开文件选择器")}
              >
                <AttachmentIcon size={16} />
              </button>

              {/* 弹性空间 */}
              <div className="flex-1" />

              {/* 模型选择下拉（最右侧，紧挨发送按钮） */}
              <div className="relative">
                <button
                  type="button"
                  className="flex h-[30px] cursor-pointer items-center gap-1 rounded-[8px] border-none bg-transparent px-2 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
                  onClick={() => {
                    setShowModelDropdown(!showModelDropdown);
                    setShowProjectDropdown(false);
                    setShowSkillDropdown(false);
                  }}
                >
                  <span>{selectedModel}</span>
                  <ChevronDownIcon size={10} />
                </button>

                {showModelDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowModelDropdown(false)} />
                    <div
                      className="absolute bottom-full right-0 z-20 mb-1 w-48 overflow-hidden rounded-[10px] border-[0.5px] py-1 shadow-md"
                      style={{
                        backgroundColor: "var(--bg-card)",
                        borderColor: "var(--border-main)",
                      }}
                    >
                      {MODELS.map((model) => (
                        <div
                          key={model}
                          onClick={() => { setSelectedModel(model); setShowModelDropdown(false); }}
                          className={cn("cursor-pointer px-3 py-1.5 text-[13px] transition-colors hover:bg-[var(--fill-tsp-white-light)]", model === selectedModel ? "text-[var(--color-primary)] font-medium" : "text-[var(--text-primary)]")}
                        >
                          {model}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* 发送按钮 */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="flex size-[34px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] border-none transition-all disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  backgroundColor: inputValue.trim()
                    ? "var(--color-primary)"
                    : "var(--fill-tsp-white-main)",
                  color: "#ffffff",
                }}
                aria-label="发送消息"
              >
                <SendIcon size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationPage;
