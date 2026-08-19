"use client";

/**
 * BC Agent 技能页 —— 企业级技能 / 外部技能市场 / 已安装技能
 *
 * 变更记录：
 * - 2026-07-03 | 初始化技能页面（产品方案 V1.1 第五章）
 *
 * 设计参考：
 * - 布局结构：doc/bcagent-product-proposal-v1.1.md 第五章「技能」
 * - 视觉风格：https://work.trae.cn/skills（tab 底边线、搜索框、上传按钮、卡片行样式）
 * - 色彩体系：BC Agent 暖灰色系（已人工调校，所有新组件严格复用 CSS 变量）
 *
 * 页面结构：
 * ┌──────────────────────────────────────────────────────────┐
 * │  技能                                          [上传技能] │
 * │  ┌────────────────────────────────────────────────────┐  │
 * │  │ [企业级技能] [外部技能市场] [已安装技能]  🔍 搜索...│  │
 * │  ├────────────────────────────────────────────────────┤  │
 * │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │  │
 * │  │  │ 🧩 名称  │ │          │ │          │           │  │
 * │  │  │    简介  │ │   ...    │ │   ...    │  ← 3列网格 │  │
 * │  │  │  [安装]  │ │  [安装]  │ │ [已安装] │           │  │
 * │  │  └──────────┘ └──────────┘ └──────────┘           │  │
 * │  └────────────────────────────────────────────────────┘  │
 * └──────────────────────────────────────────────────────────┘
 *
 * 关键规格（融合 Trae 风格 + BC 色彩）：
 * - 页面标题: 28px bold text-primary
 * - Tab: 13px font-semibold，活跃态底部 2px 边框，h-40px
 * - 搜索框: h-28px rounded-6px border-main，w-250px
 * - 上传按钮: h-32px rounded-8px primary 底色白色文字
 * - 卡片: 白色底 rounded-12px border-main，三列网格
 * - 卡片图标: 48×48 rounded-4px（对齐 Trae）
 * - 安装按钮: h-28px rounded-4px（对齐 Trae addBtn）
 */

import { PlusIcon, SearchIcon, UploadIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import React, { useCallback, useMemo, useState } from "react";
import UploadSkillModal from "@/components/UploadSkillModal";

/* ================================================================
 *  类型定义
 * ================================================================ */

/** 技能来源分类 */
type SkillTab = "enterprise" | "market" | "installed";

/** 技能数据模型 */
interface Skill {
  id: string;
  /** 技能名称 */
  name: string;
  /** 一句话简介 */
  description: string;
  /** 图标 URL（可选，无则用首字母占位） */
  iconUrl?: string;
  /** 来源：企业级 / 外部市场 */
  source: "enterprise" | "market";
  /** 是否已安装 */
  installed: boolean;
  /** 发布者（外部技能显示） */
  author?: string;
  /** 审核状态：pending=审核中 / approved=已通过 / rejected=已驳回 */
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  /** 驳回原因（rejected 时显示） */
  reviewComment?: string;
}

interface SkillsPageProps {
  /** 切换到"新建任务"并可能填入技能标签 */
  onUseSkill?: (skillName: string) => void;
}

/* ================================================================
 *  模拟数据（来自产品方案 V1.1 第五章 + BC 业务场景）
 * ================================================================ */

const MOCK_SKILLS: Skill[] = [
  // ---- 企业级技能 ----
  {
    id: "ent-1",
    name: "催收话术策略",
    description: "根据逾期阶段和客户画像，自动生成专业、合规的催收话术与沟通策略",
    source: "enterprise",
    installed: true,
    author: "信息技术部",
  },
  {
    id: "ent-2",
    name: "风控审批辅助",
    description: "自动检查贷款准入条件，逐项比对风险指标，标记关注点并输出审批建议",
    source: "enterprise",
    installed: false,
    author: "信息技术部",
  },
  {
    id: "ent-3",
    name: "房产核值辅助",
    description: "辅助房产抵押物价值评估，对比周边成交数据，判断估值合理性",
    source: "enterprise",
    installed: false,
    author: "信息技术部",
  },
  {
    id: "ent-4",
    name: "贷后监控报告",
    description: "自动汇总贷后监控指标，生成标准化监控报告并标记异常波动",
    source: "enterprise",
    installed: true,
    author: "信息技术部",
  },
  {
    id: "ent-5",
    name: "合规审查助手",
    description: "检查业务操作是否符合监管要求，自动识别合规风险点并提供整改建议",
    source: "enterprise",
    installed: false,
    author: "信息技术部",
  },
  // ---- 外部技能市场 ----
  {
    id: "ext-1",
    name: "数据分析助手",
    description: "连接数据库，用自然语言查询和分析业务数据，自动生成可视化图表",
    source: "market",
    installed: true,
    author: "DataTools",
  },
  {
    id: "ext-2",
    name: "文档智能处理",
    description: "批量处理 PDF、Word 文档，自动提取关键信息并生成结构化摘要",
    source: "market",
    installed: false,
    author: "DocAI",
  },
  {
    id: "ext-3",
    name: "PPT 自动生成",
    description: "根据文字大纲或数据报告，一键生成排版精美的演示文稿",
    source: "market",
    installed: false,
    author: "SlideFlow",
  },
  {
    id: "ext-4",
    name: "邮件智能起草",
    description: "根据简短指令生成专业邮件，支持多语言、多语气风格切换",
    source: "market",
    installed: true,
    author: "MailBot",
  },
  {
    id: "ext-5",
    name: "代码审查助手",
    description: "对代码变更进行自动审查，标记潜在缺陷、安全漏洞和性能问题",
    source: "market",
    installed: false,
    author: "CodeCheck",
  },
  {
    id: "ext-6",
    name: "会议纪要生成",
    description: "上传会议录音或文字记录，自动提炼要点、待办事项和决策摘要",
    source: "market",
    installed: false,
    author: "MeetNote",
  },
  // ---- 用户上传技能（演示审核状态） ----
  {
    id: "user-1",
    name: "自定义催收策略生成器",
    description: "根据客户画像自动生成个性化催收策略与跟进方案，支持多维数据输入",
    source: "enterprise",
    installed: true,
    author: "李磊",
    reviewStatus: "pending",
  },
  {
    id: "user-2",
    name: "催收话术助手 Pro",
    description: "增强版催收话术模板，支持多轮对话与情绪识别，适配多种催收场景",
    source: "market",
    installed: true,
    author: "陈静",
    reviewStatus: "pending",
  },
  {
    id: "user-3",
    name: "智能质检规则集",
    description: "自动化质检规则配置，覆盖合规性检查与话术评分",
    source: "enterprise",
    installed: true,
    author: "赵强",
    reviewStatus: "rejected",
    reviewComment: "与已有技能「合规审查助手」功能重叠度较高，建议整合后重新提交",
  },
];

/* ================================================================
 *  子组件
 * ================================================================ */

/**
 * Tab 按钮 —— 底部边框活跃指示（对齐 Trae tab-oMtNdU 风格）
 *
 * 规格：
 * - 13px font-semibold，h-40px，px-4px
 * - 活跃态：text-primary + border-bottom 2px solid
 * - 非活跃：text-secondary，hover 后变 text-primary
 * - 可选 badge（已安装数量）
 */
const TabButton: React.FC<{
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}> = ({ label, active, badge, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "relative flex h-[40px] cursor-pointer items-center gap-[6px] border-none bg-transparent px-[4px]",
      "text-[13px] leading-[18px] font-semibold transition-colors",
      active
        ? "text-[var(--text-primary)]"
        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
    )}
  >
    <span>{label}</span>
    {/* 计数 badge（对齐 Trae tabBadge） */}
    {badge !== undefined && (
      <span
        className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-[2px] px-[4px] text-[11px] leading-[16px]"
        style={{
          backgroundColor: "var(--fill-tsp-white-main)",
          color: "var(--text-secondary)",
        }}
      >
        {badge}
      </span>
    )}
    {/* 活跃底部边框（对齐 Trae: 2px solid #262626 → BC: color-primary） */}
    {active && (
      <span
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-[1px]"
        style={{ backgroundColor: "var(--color-primary)" }}
      />
    )}
  </button>
);

/**
 * 搜索输入框 —— 紧凑型 + 搜索按钮
 *
 * 交互：输入文本后点击搜索按钮才触发搜索，支持回车键触发
 */
const SearchInput: React.FC<{
  onSearch: (query: string) => void;
  placeholder?: string;
}> = ({ onSearch, placeholder = "搜索技能..." }) => {
  const [localValue, setLocalValue] = React.useState("");

  const handleSearch = useCallback(() => {
    onSearch(localValue.trim());
  }, [localValue, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  return (
    <div className="flex items-center gap-[6px]">
      <div
        className="flex h-[28px] items-center gap-[4px] rounded-[6px] border px-[8px] transition-colors focus-within:border-[var(--color-primary)]"
        style={{
          borderColor: "var(--border-main)",
          backgroundColor: "transparent",
          width: "180px",
        }}
      >
        <span className="flex shrink-0 items-center text-[var(--text-muted)]">
          <SearchIcon size={14} />
        </span>
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 border-none bg-transparent text-[13px] leading-[18px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        {localValue && (
          <button
            type="button"
            onClick={() => { setLocalValue(""); onSearch(""); }}
            className="flex size-[16px] shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            ×
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={handleSearch}
        className="flex h-[28px] shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-none px-[12px] text-[13px] leading-[18px] transition-colors hover:opacity-80"
        style={{
          backgroundColor: "var(--fill-tsp-white-main)",
          color: "var(--text-primary)",
        }}
      >
        搜索
      </button>
    </div>
  );
};

/**
 * 技能卡片 —— 网格布局中的单个卡片
 *
 * 融合设计：
 * - 图标: 48×48 rounded-4px（对齐 Trae cardIcon）
 * - 标题: 13px font-medium（对齐 Trae cardName）
 * - 简介: 11px text-secondary 2行截断（对齐 Trae cardDesc）
 * - 安装按钮: h-28px rounded-4px（对齐 Trae cardAddBtn）
 * - 卡片容器: 白色底 rounded-12px 0.5px border（BC 风格）
 *
 * 状态覆盖：
 * - 默认：显示「安装」按钮
 * - 已安装：显示「已安装」灰色标记，按钮不可点击
 * - hover：卡片微上浮 + 阴影
 */
const SkillCard: React.FC<{
  skill: Skill;
  onInstall?: (skill: Skill) => void;
  onEdit?: (skill: Skill) => void;
  onDelete?: (skill: Skill) => void;
}> = ({ skill, onInstall, onEdit, onDelete }) => {
  const installed = skill.installed;
  const isRejected = skill.reviewStatus === 'rejected';
  const isPending = skill.reviewStatus === 'pending';

  return (
    <div
      className={cn(
        "flex flex-col gap-[12px] rounded-[12px] border-[0.5px] p-[16px] transition-all duration-200",
        "hover:-translate-y-[2px]",
        isRejected && "opacity-75", // 已驳回技能视觉弱化
      )}
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: isRejected ? '#ffa39e' : "var(--border-main)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = "var(--shadow-md)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* 图标区（48×48，对齐 Trae） */}
      <div
        className="flex size-[48px] shrink-0 items-center justify-center overflow-hidden rounded-[4px] text-[20px] font-bold"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
          color: "var(--color-primary)",
        }}
      >
        {skill.iconUrl ? (
          <img
            src={skill.iconUrl}
            alt={skill.name}
            width={48}
            height={48}
            className="size-full object-contain"
          />
        ) : (
          skill.name.charAt(0)
        )}
      </div>

      {/* 信息区 */}
      <div className="flex flex-1 flex-col gap-[4px]">
        <span className="text-[13px] leading-[20px] font-medium text-[var(--text-primary)]">
          {skill.name}
        </span>

        <span
          className="text-[12px] leading-[18px] text-[var(--text-secondary)]"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {skill.description}
        </span>

        {skill.author && (
          <span className="text-[11px] leading-[16px] text-[var(--text-tertiary)]">
            by {skill.author}
          </span>
        )}
      </div>

      {/* 审核状态标签 */}
      {skill.reviewStatus && skill.reviewStatus !== 'approved' && (
        <div className="mt-auto flex flex-col gap-[4px]">
          {isPending && (
            <span
              className="inline-flex h-[24px] cursor-default items-center rounded-[4px] px-[8px] text-[11px] font-medium select-none"
              style={{ backgroundColor: 'rgba(250, 173, 20, 0.1)', color: '#d48806' }}
            >
              ⏳ 审核中
            </span>
          )}
          {isRejected && (
            <>
              <span
                className="inline-flex h-[24px] cursor-default items-center rounded-[4px] px-[8px] text-[11px] font-medium select-none"
                style={{ backgroundColor: 'rgba(255, 77, 79, 0.1)', color: '#cf1322' }}
              >
                ❌ 已驳回
              </span>
              {/* 驳回原因 */}
              {skill.reviewComment && (
                <span className="text-[11px] leading-[16px] text-[#cf1322] line-clamp-2">
                  原因：{skill.reviewComment}
                </span>
              )}
            </>
          )}
        </div>
      )}

      {/* 操作按钮区 */}
      <div className="mt-auto">
        {isRejected ? (
          /* 已驳回：修改重提 + 删除 */
          <div className="flex gap-[6px]">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit?.(skill); }}
              className="flex h-[28px] cursor-pointer items-center gap-[4px] rounded-[4px] border-none px-[10px] text-[12px] font-medium transition-colors"
              style={{ backgroundColor: 'transparent', color: 'var(--color-primary)' }}
              onMouseEnter={(e2) => { e2.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 8%, transparent)'; }}
              onMouseLeave={(e2) => { e2.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              📤 重新上传
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete?.(skill); }}
              className="flex h-[28px] cursor-pointer items-center rounded-[4px] border-none px-[10px] text-[12px] font-medium transition-colors"
              style={{ backgroundColor: 'transparent', color: 'var(--text-muted)' }}
              onMouseEnter={(e2) => { e2.currentTarget.style.backgroundColor = 'var(--fill-tsp-white-light)'; }}
              onMouseLeave={(e2) => { e2.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              🗑 删除
            </button>
          </div>
        ) : installed ? (
          <span
            className="inline-flex h-[28px] cursor-default items-center rounded-[4px] px-[10px] text-[12px] font-medium select-none"
            style={{ backgroundColor: "var(--fill-tsp-white-light)", color: "var(--text-tertiary)" }}
          >
            已安装
          </span>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onInstall?.(skill); }}
            className="flex h-[28px] cursor-pointer items-center gap-[4px] rounded-[4px] border-none px-[10px] text-[12px] font-medium transition-colors"
            style={{ backgroundColor: "transparent", color: "var(--color-primary)" }}
            onMouseEnter={(e2) => { e2.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--color-primary) 8%, transparent)'; }}
            onMouseLeave={(e2) => { e2.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <PlusIcon size={14} />
            <span>安装</span>
          </button>
        )}
      </div>
    </div>
  );
};

/* ================================================================
 *  主组件
 * ================================================================ */

const SkillsPage: React.FC<SkillsPageProps> = ({ onUseSkill }) => {
  /* ---- 状态 ---- */
  const [activeTab, setActiveTab] = useState<SkillTab>("enterprise");
  const [searchQuery, setSearchQuery] = useState("");
  const [skills, setSkills] = useState<Skill[]>(MOCK_SKILLS);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  /** 驳回后重新上传：记录被驳回的技能（传递驳回原因），上传确认后替换 */
  const [reuploadSkill, setReuploadSkill] = useState<Skill | null>(null);
  /** 删除确认 */
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);

  /* ---- 派生数据：按标签页过滤 + 搜索过滤 ---- */
  const filteredSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return skills.filter((skill) => {
      // 标签页筛选
      if (activeTab === "enterprise" && skill.source !== "enterprise") return false;
      if (activeTab === "market" && skill.source !== "market") return false;
      if (activeTab === "installed" && !skill.installed) return false;

      // 企业级和外部市场标签页：仅显示已审核通过的技能（无 reviewStatus 字段的旧数据视为已通过）
      if (activeTab === "enterprise" || activeTab === "market") {
        if (skill.reviewStatus && skill.reviewStatus !== 'approved') return false;
      }

      // 搜索筛选
      if (query) {
        const matchName = skill.name.toLowerCase().includes(query);
        const matchDesc = skill.description.toLowerCase().includes(query);
        if (!matchName && !matchDesc) return false;
      }

      return true;
    });
  }, [skills, activeTab, searchQuery]);

  /* ---- 已安装数量（各标签页 badge） ---- */
  const installedCount = useMemo(
    () => skills.filter((s) => s.installed).length,
    [skills]
  );
  const enterpriseCount = useMemo(
    () => skills.filter((s) => s.source === "enterprise").length,
    [skills]
  );
  const marketCount = useMemo(
    () => skills.filter((s) => s.source === "market").length,
    [skills]
  );

  /* ---- 安装技能 ---- */
  const handleInstall = useCallback((skill: Skill) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === skill.id ? { ...s, installed: true } : s))
    );
  }, []);

  /* ---- 驳回后重新上传：打开上传弹窗（带驳回原因） ---- */
  const handleReupload = useCallback((skill: Skill) => {
    setReuploadSkill(skill);
    setUploadModalOpen(true);
  }, []);

  /* ---- 删除已驳回技能 ---- */
  const handleDelete = useCallback((skill: Skill) => {
    setSkills((prev) => prev.filter((s) => s.id !== skill.id));
    setDeleteTarget(null);
    alert(`【演示】技能「${skill.name}」已删除`);
  }, []);

  /* ---- 点击卡片跳转到会话页并使用技能 ---- */
  const handleCardClick = useCallback(
    (skill: Skill) => {
      if (skill.installed) {
        // 已安装的技能：提示可以在会话中使用
        onUseSkill?.(skill.name);
      } else {
        handleInstall(skill);
      }
    },
    [handleInstall, onUseSkill]
  );

  /* ================================================================
   *  渲染
   * ================================================================ */

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      {/* ===== 页面标题区 ===== */}
      <div
        className="flex shrink-0 items-center justify-between px-[40px] pt-[44px] pb-[12px]"
      >
        <div className="flex flex-col gap-[4px]">
          <h1 className="m-0 text-[24px] leading-[32px] font-semibold text-[var(--text-primary)] tracking-[0.1px]">
            技能
          </h1>
          <p className="m-0 text-[13px] leading-[20px] text-[var(--text-secondary)]">
            安装和管理技能，为智能体解锁业务能力
          </p>
        </div>
        <button
          onClick={() => setUploadModalOpen(true)}
          className="btn-primary flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] border-none px-[16px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <UploadIcon size={14} />
          上传技能
        </button>
      </div>

      {/* ===== Tab 栏 + 搜索（对齐 Trae tabsBar 布局） ===== */}
      <div
        className="flex shrink-0 items-center justify-between border-b-[1px] px-[40px]"
        style={{ borderColor: "var(--border-main)" }}
      >
        {/* Tab 按钮组（对齐 Trae: tabs-rGCEik） */}
        <div className="flex items-center gap-[24px]">
          <TabButton
            label="企业级技能"
            active={activeTab === "enterprise"}
            badge={enterpriseCount}
            onClick={() => setActiveTab("enterprise")}
          />
          <TabButton
            label="外部技能市场"
            active={activeTab === "market"}
            badge={marketCount}
            onClick={() => setActiveTab("market")}
          />
          <TabButton
            label="已安装技能"
            active={activeTab === "installed"}
            badge={installedCount}
            onClick={() => setActiveTab("installed")}
          />
        </div>

        {/* 搜索框（右侧） */}
        <div className="pb-[8px]">
          <SearchInput
            onSearch={setSearchQuery}
            placeholder="搜索技能..."
          />
        </div>
      </div>

      {/* ===== 技能卡片网格 ===== */}
      <div className="flex-1 overflow-y-auto px-[40px] py-[24px]">
        {filteredSkills.length > 0 ? (
          <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => handleCardClick(skill)}
                className="cursor-pointer"
              >
                <SkillCard skill={skill} onInstall={handleInstall} onEdit={handleReupload} onDelete={setDeleteTarget} />
              </div>
            ))}
          </div>
        ) : (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-[48px]">🧩</span>
            <p className="mt-4 text-[14px] font-medium text-[var(--text-primary)]">
              {activeTab === "installed"
                ? "还没有安装任何技能"
                : "没有找到匹配的技能"}
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              {activeTab === "installed"
                ? "前往企业级技能或外部技能市场安装"
                : "试试其他关键词或切换标签页"}
            </p>
          </div>
        )}
      </div>
    {/* 上传技能弹窗（技能类型跟随当前 tab 联动；驳回后重新上传时显示驳回原因） */}
    <UploadSkillModal
      open={uploadModalOpen}
      onClose={() => { setUploadModalOpen(false); setReuploadSkill(null); }}
      defaultSkillType={
        reuploadSkill
          ? (reuploadSkill.source === 'market' ? 'marketplace' : 'enterprise')
          : (activeTab === 'market' ? 'marketplace' : 'enterprise')
      }
      rejectionReason={reuploadSkill?.reviewComment}
      onConfirm={(fileName, _file, skillType, scope) => {
        const scopeDesc = scope.type === 'all'
          ? '全部人员'
          : `${scope.departmentIds.length}个部门、${scope.employeeIds.length}人`;
        if (reuploadSkill) {
          // 驳回后重新上传：替换旧技能，状态回到 pending
          setSkills((prev) =>
            prev.map((s) =>
              s.id === reuploadSkill.id
                ? {
                    ...s,
                    name: fileName.replace(/\.(zip|skill|md)$/, ''),
                    description: `用户重新上传的${skillType === 'marketplace' ? '外部市场' : '企业级'}技能（演示）`,
                    source: skillType === 'marketplace' ? 'market' : 'enterprise',
                    reviewStatus: 'pending',
                    reviewComment: undefined,
                  }
                : s,
            ),
          );
          setReuploadSkill(null);
          alert(`【演示】技能「${fileName}」已重新上传并提交审核（使用范围：${scopeDesc}）`);
        } else {
          // 全新上传
          const source = skillType === 'marketplace' ? 'market' : 'enterprise';
          const newSkill: Skill = {
            id: `user-${Date.now()}`,
            name: fileName.replace(/\.(zip|skill|md)$/, ''),
            description: `用户上传的${skillType === 'marketplace' ? '外部市场' : '企业级'}技能（演示）`,
            source: source as 'enterprise' | 'market',
            installed: true,
            author: '当前用户',
            reviewStatus: 'pending',
          };
          setSkills((prev) => [newSkill, ...prev]);
          alert(`【演示】${skillType === 'marketplace' ? '外部市场' : '企业级'}技能「${fileName}」已提交（使用范围：${scopeDesc}），等待管理员审核。`);
        }
      }}
    />
    {/* 删除确认弹窗 */}
    {deleteTarget && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onClick={() => setDeleteTarget(null)}>
        <div className="mx-4 w-full max-w-[360px] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }} onClick={(e) => e.stopPropagation()}>
          <div className="p-[24px] text-center">
            <h4 className="text-[15px] font-semibold text-[var(--text-primary)]">删除技能</h4>
            <p className="mt-[8px] text-[13px] leading-[20px] text-[var(--text-secondary)]">
              确定要删除「{deleteTarget.name}」吗？删除后需重新上传。
            </p>
          </div>
          <div className="flex border-t-[0.5px]" style={{ borderColor: 'var(--border-main)' }}>
            <button onClick={() => setDeleteTarget(null)} className="flex-1 h-[44px] cursor-pointer border-none bg-transparent text-[14px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]">取消</button>
            <div className="w-[0.5px] self-stretch" style={{ backgroundColor: 'var(--border-main)' }} />
            <button onClick={() => handleDelete(deleteTarget)} className="flex-1 h-[44px] cursor-pointer border-none bg-transparent text-[14px] font-medium text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_6%,transparent)]">删除</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default SkillsPage;
