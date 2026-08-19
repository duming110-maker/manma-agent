"use client";

/**
 * BC Agent 左侧导航栏 —— 精确对齐 manus.im/app 布局规范
 *
 * 变更记录：
 * - 2026-07-03 | 初始化
 * - 2026-07-03 | 精确对齐 manus：20px图标容器、工作事项/任务纯文字标题、
 *               ps-24px会话缩进、暖调半透明填充、无图标左侧标题
 *
 * 精确设计参数（从 manus.im/app CDP 提取）：
 * ┌──────────────────────────────────────┐
 * │  Logo(28px) BC Agent  [🔍] [折叠]   │ ← 56px header
 * │  [✏️20px] 新建任务           ← ps-8px│
 * │  [🤖20px] Agent                     │
 * │  [🧩20px] 插件                      │
 * │  [⏰20px] 定时任务                   │
 * │  [📁20px] 库                        │
 * │                                      │
 * │  工作事项                        [+]  ▾  │ ← 一级：纯文字13px text-tertiary
 * │  [📁20px] 催收工作事项            [⋮]   │ ← 二级：20px文件夹图标 ps-8px
 * │           会话1 - 关于...           │ ← 三级：ps-24px 纯文字
 * │           会话2                     │
 * │  [📁20px] 风控分析                  │
 * │                                      │ ← 自然间距（无额外margin）
 * │  任务                        ▾      │ ← 一级：与工作事项同级
 * │           自由会话1                 │ ← 二级：ps-8px 纯文字
 * │           自由会话2                 │
 * ├──────────────────────────────────────┤
 * │  👤 张三                    ▾       │ ← 用户信息
 * └──────────────────────────────────────┘
 *
 * 关键规格：
 * - 导航项: h-36px rounded-10px ps-8px pe-2px gap-8px
 * - 图标容器: size-20px（非32px！）
 * - 一级分组标题: 无左侧图标，13px font-medium text-tertiary，ps-10px pe-2px
 * - 工作事项二级: ps-8px，20px文件夹图标，无展开箭头
 * - 会话三级: ps-24px（非56px！），无左侧图标占位
 * - 活跃态: 仅背景变化，文字颜色不变
 * - 间距: gap-1px 全局紧凑
 */

import { departments, employees } from "@/mock/org";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import type { SelectOption } from "@/components/SearchableMultiSelect";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CronIcon,
  FolderIcon,
  LibraryIcon,
  LogoutIcon,
  MoonIcon,
  MoreIcon,
  NewTaskIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  SkillsIcon,
  SunIcon,
  UserIcon
} from "@/components/icons";
import { cn } from "@/lib/utils";
import React, { useCallback, useEffect, useRef, useState } from "react";

/* ================================================================
 *  类型
 * ================================================================ */

type NavKey = "new-task" | "agent" | "cron" | "library";
export type { NavKey };

interface Project { id: string; name: string; conversations: Conversation[]; /** 审核状态（用户创建的工作事项需要审核） */ reviewStatus?: 'pending' | 'approved' | 'rejected'; }
interface Conversation { id: string; title: string; active?: boolean; }

interface SidebarProps {
  activeNav?: NavKey;
  onNavChange?: (key: NavKey) => void;
  activeConversationId?: string;
  onConversationSelect?: (conversationId: string, projectId?: string) => void;
  userName?: string;
  userAvatar?: string;
  collapsed?: boolean;
  onMobileClick?: () => void;
  onSearchClick?: () => void;
  onToggleCollapse?: () => void;
  /** 打开设置页面回调 */
  onOpenSettings?: () => void;
  /** 当前主题 */
  theme?: "light" | "dark";
  /** 切换主题回调 */
  onToggleTheme?: () => void;
}

/* ================================================================
 *  模拟数据
 * ================================================================ */

const MOCK_PROJECTS: Project[] = [
  { id: "proj-1", name: "催收工作事项", conversations: [
    { id: "conv-1", title: "关于催收策略的优化方案讨论" },
    { id: "conv-2", title: "逾期客户数据分析" },
  ]},
  { id: "proj-2", name: "风控分析", conversations: [
    { id: "conv-3", title: "准入规则评审" },
  ]},
  { id: "proj-3", name: "贷后催收自动化", reviewStatus: 'pending', conversations: [] },
];

const MOCK_FREE_CONVERSATIONS: Conversation[] = [
  { id: "free-1", title: "关于催收策略的初步想法" },
  { id: "free-2", title: "数据分析思路整理" },
  { id: "free-3", title: "周报模板设计" },
];

/** 模拟可选择的技能 */
const AVAILABLE_SKILLS = [
  "催收话术策略（企业级）",
  "风控审批辅助（企业级）",
  "房产核值辅助（企业级）",
  "贷后监控报告（企业级）",
  "数据分析助手（外部）",
  "文档智能处理（外部）",
  "邮件智能起草（外部）",
];

/* ================================================================
 *  新建工作事项弹窗
 * ================================================================ */

const CreateProjectModal: React.FC<{
  open: boolean;
  onClose: () => void;
  /** 当前登录用户名（用于默认选中自己） */
  userName?: string;
}> = ({ open, onClose, userName = "张三" }) => {
  const [form, setForm] = useState({
    name: "",
    description: "",
    skills: [] as string[],
    coreDuty: "",
    workStyle: "",
    workflow: "",
  });
  /**
   * 分配范围：默认指定人员（而非全部人员），避免误操作扩大可见范围。
   * 指定人员时默认选中当前用户自己。
   */
  const [scopeType, setScopeType] = useState<'all' | 'specified'>('specified');
  /** 指定部门 ID */
  const [deptIds, setDeptIds] = useState<number[]>([]);
  /** 指定人员 ID（默认选中当前用户） */
  const [empIds, setEmpIds] = useState<number[]>(() => {
    // 在 employees 中按名称匹配当前用户，默认选中自己
    const self = employees.find((e) => e.name === userName);
    return self ? [self.id] : [];
  });

  /** 部门选项（SearchableMultiSelect 格式） */
  const deptOptions: SelectOption[] = departments.map((d) => ({
    value: d.id,
    label: d.name,
    subtitle: d.code,
  }));

  /** 人员选项（SearchableMultiSelect 格式） */
  const empOptions: SelectOption[] = employees.map((e) => ({
    value: e.id,
    label: e.name,
    subtitle: e.jobNumber,
  }));

  const resetForm = () => {
    setForm({ name: "", description: "", skills: [], coreDuty: "", workStyle: "", workflow: "" });
    setScopeType('specified');
    setDeptIds([]);
    // 重置时也要默认选中自己
    const self = employees.find((e) => e.name === userName);
    setEmpIds(self ? [self.id] : []);
  };

  React.useEffect(() => {
    if (open) {
      resetForm();
    }
  }, [open]);

  const toggleSkill = (skill: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const inputS: React.CSSProperties = {
    backgroundColor: "var(--bg-main)",
    borderColor: "var(--border-main)",
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
    >
      <div
        className="mx-4 flex max-h-[90vh] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border-main)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          className="flex shrink-0 items-center justify-between border-b-[0.5px] px-[24px] py-[18px]"
          style={{ borderColor: "var(--border-main)" }}
        >
          <h3 className="m-0 text-[16px] leading-[24px] font-semibold text-[var(--text-primary)]">
            创建工作事项
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-[28px] cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-[var(--text-muted)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
          >
            ✕
          </button>
        </div>

        {/* 表单内容 */}
        <div className="flex-1 overflow-y-auto px-[24px] py-[20px]">
          <div className="flex flex-col gap-[16px]">
            {/* 工作事项名称 */}
            <label className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                工作事项名称 <span className="text-[var(--color-error)]">*</span>
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="自定义工作事项名称"
                className="h-[36px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                style={inputS}
              />
            </label>

            {/* 一句话定位 */}
            <label className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                一句话定位
              </span>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="简要描述工作事项的目的和范围"
                className="h-[36px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                style={inputS}
              />
            </label>

            {/* 技能选择 */}
            <div className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                技能选择
              </span>
              <div className="flex flex-wrap gap-[6px]">
                {AVAILABLE_SKILLS.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    className="flex h-[28px] cursor-pointer items-center gap-[4px] rounded-[6px] border-[0.5px] px-[10px] text-[12px] leading-[18px] transition-colors"
                    style={{
                      backgroundColor: form.skills.includes(skill)
                        ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                        : "var(--bg-main)",
                      borderColor: form.skills.includes(skill)
                        ? "var(--color-primary)"
                        : "var(--border-main)",
                      color: form.skills.includes(skill)
                        ? "var(--color-primary)"
                        : "var(--text-secondary)",
                    }}
                  >
                    <span>{form.skills.includes(skill) ? "✓" : "＋"}</span>
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            {/* 核心职责 */}
            <label className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                核心职责
              </span>
              <textarea
                value={form.coreDuty}
                onChange={(e) => setForm({ ...form, coreDuty: e.target.value })}
                placeholder="定义 AI 在该工作事项中的核心职责..."
                rows={3}
                className="min-h-[80px] resize-y rounded-[8px] border-[0.5px] p-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                style={inputS}
              />
            </label>

            {/* 工作风格 */}
            <label className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                工作风格
              </span>
              <textarea
                value={form.workStyle}
                onChange={(e) => setForm({ ...form, workStyle: e.target.value })}
                placeholder="定义 AI 的回复风格和工作方式..."
                rows={3}
                className="min-h-[80px] resize-y rounded-[8px] border-[0.5px] p-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                style={inputS}
              />
            </label>

            {/* 工作流程 */}
            <label className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                工作流程
              </span>
              <textarea
                value={form.workflow}
                onChange={(e) => setForm({ ...form, workflow: e.target.value })}
                placeholder="定义 AI 在该工作事项中的工作步骤..."
                rows={3}
                className="min-h-[80px] resize-y rounded-[8px] border-[0.5px] p-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                style={inputS}
              />
            </label>

            {/* 分配范围（部门+人员混合选择，类似模型配置） */}
            <div className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                分配范围
              </span>
              <div className="flex gap-[8px]">
                <button
                  type="button"
                  onClick={() => setScopeType('all')}
                  className="rounded-[6px] border px-[12px] py-[6px] text-[12px] transition-colors"
                  style={{
                    borderColor: scopeType === 'all' ? 'var(--color-primary)' : 'var(--border-main)',
                    backgroundColor: scopeType === 'all' ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                    color: scopeType === 'all' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  }}
                >
                  全部人员
                </button>
                <button
                  type="button"
                  onClick={() => setScopeType('specified')}
                  className="rounded-[6px] border px-[12px] py-[6px] text-[12px] transition-colors"
                  style={{
                    borderColor: scopeType === 'specified' ? 'var(--color-primary)' : 'var(--border-main)',
                    backgroundColor: scopeType === 'specified' ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                    color: scopeType === 'specified' ? 'var(--color-primary)' : 'var(--text-secondary)',
                  }}
                >
                  指定人员
                </button>
              </div>
              {scopeType === 'specified' && (
                <div className="flex gap-[10px]">
                  {/* 部门选择：下拉+搜索多选 */}
                  <div className="flex-1">
                    <span className="text-[11px] text-[var(--text-muted)]">部门</span>
                    <div className="mt-[4px]">
                      <SearchableMultiSelect
                        options={deptOptions}
                        selected={deptIds}
                        onChange={setDeptIds}
                        placeholder="选择部门"
                        searchPlaceholder="搜索部门..."
                      />
                    </div>
                  </div>
                  {/* 人员选择：下拉+搜索多选 */}
                  <div className="flex-1">
                    <span className="text-[11px] text-[var(--text-muted)]">人员</span>
                    <div className="mt-[4px]">
                      <SearchableMultiSelect
                        options={empOptions}
                        selected={empIds}
                        onChange={setEmpIds}
                        placeholder="选择人员"
                        searchPlaceholder="搜索人员..."
                      />
                    </div>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-[var(--text-muted)]">
                选择「全部人员」则该工作事项对所有员工可见；选择「指定人员」则仅选中部门和人员可见。
              </p>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          className="flex shrink-0 items-center justify-end gap-[8px] border-t-[0.5px] px-[24px] py-[16px]"
          style={{ borderColor: "var(--border-main)" }}
        >
          <button
            type="button"
            onClick={() => { resetForm(); onClose(); }}
            className="flex h-[32px] cursor-pointer items-center rounded-[8px] border-[0.5px] border-[var(--border-main)] bg-transparent px-[16px] text-[13px] leading-[20px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              if (!form.name.trim()) return;
              const scopeDesc = scopeType === 'all'
                ? '全部人员'
                : `${deptIds.length}个部门、${empIds.length}人`;
              alert(`【演示】工作事项「${form.name}」创建成功！（分配范围：${scopeDesc}），等待管理员审核。`);
              resetForm();
              onClose();
            }}
            disabled={!form.name.trim()}
            className="flex h-[32px] cursor-pointer items-center rounded-[8px] border-none px-[16px] text-[13px] leading-[20px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            创建
          </button>
        </div>
      </div>
    </div>
  );
};

/* ================================================================
 *  BC Agent Logo（无背景色的简洁图标）
 * ================================================================ */

const LogoIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <img src="/BC-logo2-1.png" alt="BC Agent" width={size} height={size} />
);

/* ================================================================
 *  子组件
 * ================================================================ */

/**
 * 主导航项（新建任务 / Agent / 插件 / 定时任务 / 库）
 *
 * 精确规格：
 * - h-36px, rounded-10px
 * - ps-8px pe-2px（左8px右2px内边距）
 * - gap-8px（图标与文字间距）
 * - 图标容器: size-20px（不是32px！），SVG 18px
 * - 文字: 14px font-normal
 * - hover: bg-[var(--fill-tsp-white-light)]
 * - 活跃态: 仅背景变化，文字色不变（!）
 */
const NavItem: React.FC<{
  icon: React.ReactNode; label: string; active?: boolean; onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      "flex h-[36px] w-full cursor-pointer items-center gap-[8px] rounded-[10px] ps-[8px] pe-[2px]",
      "transition-colors select-none",
      "hover:bg-[var(--fill-tsp-white-light)]",
      active && "bg-[var(--fill-tsp-white-light)]"
    )}
    role="button" tabIndex={0}
    aria-current={active ? "page" : undefined}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
  >
    {/* 图标容器: 20px（精确对齐 manus） */}
    <span className="flex size-[20px] shrink-0 items-center justify-center">
      {icon}
    </span>
    <span className="truncate text-[14px] font-normal leading-[21px] text-[var(--text-primary)]">
      {label}
    </span>
  </div>
);

/**
 * 一级分组标题（工作事项 / 任务）
 *
 * 重要：manus 的 工作事项/任务 标题没有左侧图标！纯文字 + 右侧操作区。
 *
 * 精确规格：
 * - h-36px, rounded-10px
 * - ps-10px pe-2px py-2px
 * - 文字: 13px font-medium text-tertiary tracking-[-0.091px]
 * - sticky top-0 z-[2]
 * - hover 用绝对定位 overlay（简化：直接 bg 变化）
 */
const SectionHeader: React.FC<{
  label: string; expanded: boolean; onToggle: () => void; extra?: React.ReactNode;
}> = ({ label, expanded, onToggle, extra }) => (
  <div
    onClick={onToggle}
    className={cn(
      "group sticky top-0 z-[2] flex h-[36px] cursor-pointer items-center justify-between",
      "rounded-[10px] ps-[10px] pe-[2px] py-[2px] gap-[12px] select-none",
      "bg-[var(--bg-nav)] hover:bg-[var(--fill-tsp-white-light)]"
    )}
    role="button" tabIndex={0}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
  >
    {/* 左侧内容：只有标题文字，无图标！ */}
    <div className="flex flex-1 min-w-0 items-center gap-0.5">
      <span className="text-[13px] leading-[18px] text-[var(--text-tertiary)] font-medium min-w-0 truncate"
        style={{ letterSpacing: "-0.091px" }}>
        {label}
      </span>
      {/* 右侧小箭头（manus 在文字后面有小chevron） */}
      <span className="text-[var(--text-tertiary)]">
        {expanded
          ? <ChevronDownIcon size={12} />
          : <ChevronRightIcon size={12} />
        }
      </span>
    </div>

    {/* 右侧操作按钮 */}
    {extra && <span onClick={(e) => e.stopPropagation()}>{extra}</span>}
  </div>
);

/**
 * 二级：工作事项名称行
 *
 * 精确规格：
 * - h-36px, rounded-10px
 * - ps-8px pe-2px（与主导航项相同的左侧缩进）
 * - gap-12px（外层），内层 gap-8px
 * - 图标容器: size-20px（文件夹图标 18px）
 * - 文字: 14px font-normal（非medium！）
 * - sticky top-[36px] z-[1]（停靠在分组标题下方）
 * - 无展开箭头！只有文件夹图标 + 名称
 */
const ProjectRow: React.FC<{
  project: Project; expanded: boolean; onToggle: () => void;
}> = ({ project, expanded, onToggle }) => (
  <div
    onClick={onToggle}
    className={cn(
      "group sticky top-[36px] z-[1] flex h-[36px] w-full cursor-pointer items-center",
      "overflow-hidden rounded-[10px] ps-[8px] pe-[2px] gap-[12px] select-none",
      "bg-[var(--bg-nav)] hover:bg-[var(--fill-tsp-white-light)]"
    )}
    role="button" tabIndex={0}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }}
  >
    {/* 内容区：文件夹图标 + 名称 */}
    <div className="flex flex-1 min-w-0 items-center gap-[8px]">
      {/* 文件夹图标容器: 20px */}
      <span className="flex size-[20px] shrink-0 items-center justify-center text-[var(--text-muted)]">
        {expanded
          ? <FolderIcon size={16} />
          : <FolderIcon size={16} />
        }
      </span>
      {/* 工作事项名称 */}
      <span className="min-w-0 flex-1 truncate text-[14px] font-normal leading-[21px] text-[var(--text-primary)]">
        {project.name}
      </span>
      {/* 审核状态指示器（仅用户上传且待审核/已驳回时显示） */}
      {project.reviewStatus === 'pending' && (
        <span
          className="inline-flex h-[18px] shrink-0 items-center rounded-[2px] px-[4px] text-[10px] select-none"
          style={{
            backgroundColor: 'rgba(250, 173, 20, 0.12)',
            color: '#d48806',
          }}
        >
          审核中
        </span>
      )}
      {project.reviewStatus === 'rejected' && (
        <span
          className="inline-flex h-[18px] shrink-0 items-center rounded-[2px] px-[4px] text-[10px] select-none"
          style={{
            backgroundColor: 'rgba(255, 77, 79, 0.12)',
            color: '#cf1322',
          }}
        >
          已驳回
        </span>
      )}
      {project.reviewStatus === 'approved' && (
        <span
          className="inline-flex h-[18px] shrink-0 items-center rounded-[2px] px-[4px] text-[10px] select-none"
          style={{
            backgroundColor: 'rgba(82, 196, 26, 0.12)',
            color: '#389e0d',
          }}
        >
          已通过
        </span>
      )}
    </div>

    {/* 操作按钮：hover 时出现 */}
    <span
      className="invisible flex size-0 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-main)] group-hover:visible group-hover:size-[32px]"
      onClick={(e) => { e.stopPropagation(); /* TODO */ }}
    >
      <MoreIcon size={14} />
    </span>
    <span
      className="invisible flex size-0 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-main)] group-hover:visible group-hover:size-[32px]"
      onClick={(e) => { e.stopPropagation(); /* TODO */ }}
    >
      <PlusIcon size={14} />
    </span>
  </div>
);

/**
 * 会话行（三级：工作事项子会话，或 二级：自由会话）
 *
 * 工作事项子会话: ps-24px（精确对齐 manus）
 * 自由会话: ps-8px（与主导航项同级缩进）
 *
 * 精确规格：
 * - h-36px, rounded-10px, gap-8px
 * - 无左侧图标容器（直接用文字）
 * - hover 时右侧出现操作按钮
 */
const ConversationRow: React.FC<{
  conversation: Conversation; active: boolean;
  indent?: boolean; /* true=工作事项子会话 ps-24px, false=自由会话 ps-8px */
  onClick: () => void;
  onMoreClick?: (conv: Conversation) => void;
}> = ({ conversation, active, indent, onClick, onMoreClick }) => (
  <div
    onClick={onClick}
    className={cn(
      "group flex h-[36px] w-full cursor-pointer items-center gap-[8px] rounded-[10px] pe-[2px]",
      "transition-colors select-none",
      "hover:bg-[var(--fill-tsp-white-light)]",
      active && "bg-[var(--fill-tsp-white-light)]",
      indent ? "ps-[24px]" : "ps-[8px]"
    )}
    role="button" tabIndex={0}
    aria-current={active ? "true" : undefined}
    title={conversation.title}
    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onClick(); }}
  >
    {/* 活跃指示圆点（6px，居中在文本左侧） */}
    {active && (
      <span className="ml-[-14px] mr-[-6px] inline-block size-[6px] shrink-0 rounded-full bg-[var(--color-primary)]" />
    )}

    {/* 会话标题 */}
    <span className={cn(
      "min-w-0 flex-1 truncate text-[14px] leading-[21px] text-[var(--text-primary)]",
      active ? "font-normal" : "font-normal"
    )}>
      {conversation.title}
    </span>

    {/* hover 操作按钮（三点菜单） */}
    <span
      className="invisible flex size-0 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-main)] group-hover:visible group-hover:size-[32px]"
      onClick={(e) => { e.stopPropagation(); onMoreClick?.(conversation); }}
    >
      <MoreIcon size={14} />
    </span>
  </div>
);

/* ================================================================
 *  主组件
 * ================================================================ */

const Sidebar: React.FC<SidebarProps> = ({
  activeNav = "new-task", onNavChange,
  activeConversationId, onConversationSelect,
  userName = "张三", userAvatar,
  collapsed = false, onMobileClick,
  onSearchClick, onToggleCollapse,
  onOpenSettings, theme = "light", onToggleTheme,
}) => {
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    () => new Set(MOCK_PROJECTS.map((p) => p.id))
  );
  /* 用户菜单弹窗 */
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [themeSubOpen, setThemeSubOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  /* 新建工作事项弹窗 */
  const [projectModalOpen, setProjectModalOpen] = useState(false);

  /* 会话操作弹窗 */
  const [convMenuOpen, setConvMenuOpen] = useState<string | null>(null); // 当前打开菜单的会话id
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [operatingConv, setOperatingConv] = useState<Conversation | null>(null);
  const [renameValue, setRenameValue] = useState("");

  /** 打开会话操作菜单 */
  const openConvMenu = (conv: Conversation) => {
    setOperatingConv(conv);
    setConvMenuOpen(conv.id);
  };

  /** 关闭菜单并重置 */
  const closeConvMenu = () => {
    setConvMenuOpen(null);
    setOperatingConv(null);
  };

  /** 打开重命名弹窗 */
  const handleRename = () => {
    if (!operatingConv) return;
    setRenameValue(operatingConv.title);
    setRenameModalOpen(true);
    setConvMenuOpen(null);
  };

  /** 确认重命名 */
  const confirmRename = () => {
    if (!operatingConv || !renameValue.trim()) return;
    alert(`【演示】会话已重命名为「${renameValue.trim()}」`);
    setRenameModalOpen(false);
    setOperatingConv(null);
  };

  /** 打开删除确认弹窗 */
  const handleDeleteConfirm = () => {
    setDeleteConfirmOpen(true);
    setConvMenuOpen(null);
  };

  /** 确认删除 */
  const confirmDelete = () => {
    if (!operatingConv) return;
    alert(`【演示】会话「${operatingConv.title}」已删除（30天备份期内可由管理员恢复）`);
    setDeleteConfirmOpen(false);
    setOperatingConv(null);
  };

  /* 点击外部关闭菜单 */
  useEffect(() => {
    if (!userMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
        setThemeSubOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [userMenuOpen]);

  const toggleProject = useCallback((projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }, []);

  const navItems = [
    { key: "new-task" as NavKey, label: "新建任务", icon: <NewTaskIcon size={18} /> },
    { key: "agent" as NavKey, label: "技能", icon: <SkillsIcon size={18} /> },
    { key: "cron" as NavKey, label: "定时任务", icon: <CronIcon size={18} /> },
    { key: "library" as NavKey, label: "库", icon: <LibraryIcon size={18} /> },
  ];

  /* ---- 折叠态 ---- */
  if (collapsed) {
    return (
      <aside
        className="flex h-full flex-col items-center gap-[1px] px-[8px] pt-[12px]"
        style={{ backgroundColor: "var(--bg-nav)", width: "60px" }}
      >
        <div onClick={onToggleCollapse}
          className="flex size-[36px] cursor-pointer items-center justify-center rounded-[10px] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
          title="展开侧栏">
          <ChevronRightIcon size={18} />
        </div>
        {navItems.map((item) => (
          <div key={item.key}
            onClick={() => { onNavChange?.(item.key); onMobileClick?.(); }}
            className={cn(
              "flex size-[36px] cursor-pointer items-center justify-center rounded-[10px] transition-colors",
              "hover:bg-[var(--fill-tsp-white-light)]",
              activeNav === item.key && "bg-[var(--fill-tsp-white-light)]"
            )}
            title={item.label}>
            <span className="flex size-[20px] items-center justify-center">{item.icon}</span>
          </div>
        ))}
      </aside>
    );
  }

  /* ---- 展开态 ---- */
  return (
    <aside
      className="flex h-full flex-col select-none"
      style={{ width: "300px", backgroundColor: "var(--bg-nav)", borderRight: "1px solid var(--border-main)" }}
      aria-label="侧栏导航"
    >
      {/* ===== Header: Logo + 搜索 + 折叠（56px） ===== */}
      <div className="pointer-events-auto flex h-[56px] shrink-0 items-center justify-between py-[12px] pe-[10px] ps-[12px]">
        {/* Logo: 无背景图标 + BC Agent 文字 */}
        <div
          className="flex cursor-pointer items-center gap-0.5 text-[14px] text-[var(--text-primary)] clickable"
          onClick={() => onNavChange?.("new-task")}
        >
          <span className="flex shrink-0 items-center justify-center">
            <LogoIcon size={28} />
          </span>
          <span className="truncate font-medium">BC Agent</span>
        </div>

        {/* 右侧：搜索 + 折叠 */}
        <div className="flex items-center gap-[2px]">
          <div onClick={onSearchClick}
            className="flex size-[32px] cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)] ms-auto me-[4px]"
            title="搜索会话" role="button" tabIndex={0}>
            <SearchIcon size={18} />
          </div>
          <div onClick={onToggleCollapse}
            className="flex size-[32px] cursor-pointer items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
            title="折叠侧栏" role="button" tabIndex={0}>
            <ChevronLeftIcon size={18} />
          </div>
        </div>
      </div>

      {/* ===== 导航列表（flex-1 可滚动） ===== */}
      <div className="flex min-h-0 flex-1 flex-col gap-[1px] overflow-y-auto overflow-x-hidden p-[8px] pb-0">
        {/* 主导航 */}
        {navItems.map((item) => (
          <NavItem key={item.key} icon={item.icon} label={item.label}
            active={activeNav === item.key}
            onClick={() => onNavChange?.(item.key)} />
        ))}

        {/* ======== 工作事项分组（一级标题，仅文字无图标） ======== */}
        <SectionHeader label="工作事项" expanded={projectsExpanded}
          onToggle={() => setProjectsExpanded(!projectsExpanded)}
          extra={
            <span
              className="flex size-[32px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-main)]"
              title="新建工作事项"
              onClick={(e) => { e.stopPropagation(); setProjectModalOpen(true); }}>
              <PlusIcon size={16} />
            </span>
          }
        />

        {projectsExpanded && (
          <div className="flex flex-col gap-[1px]">
            {MOCK_PROJECTS.map((project) => {
              const isExpanded = expandedProjects.has(project.id);
              return (
                <React.Fragment key={project.id}>
                  {/* 二级：工作事项名称（含文件夹图标，无展开箭头） */}
                  <ProjectRow project={project} expanded={isExpanded}
                    onToggle={() => toggleProject(project.id)} />
                  {/* 三级：会话记录（ps-24px 缩进） */}
                  {isExpanded && project.conversations.map((conv) => (
                    <ConversationRow key={conv.id} conversation={conv}
                      active={activeConversationId === conv.id} indent
                      onClick={() => onConversationSelect?.(conv.id, project.id)}
                      onMoreClick={openConvMenu} />
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* ======== 任务分组（一级标题，与工作事项同级无间距） ======== */}
        <SectionHeader label="任务" expanded={tasksExpanded}
          onToggle={() => setTasksExpanded(!tasksExpanded)} />

        {tasksExpanded && (
          <div className="flex flex-col gap-[1px]">
            {MOCK_FREE_CONVERSATIONS.map((conv) => (
              <ConversationRow key={conv.id} conversation={conv}
                active={activeConversationId === conv.id}
                onClick={() => onConversationSelect?.(conv.id)}
                onMoreClick={openConvMenu} />
            ))}
          </div>
        )}

        {MOCK_PROJECTS.length === 0 && MOCK_FREE_CONVERSATIONS.length === 0 && (
          <div className="py-12 text-center">
            <span className="text-[13px] text-[var(--text-muted)]">暂无会话记录</span>
          </div>
        )}
      </div>

      {/* ===== 底部用户信息 ===== */}
      <div className="relative flex shrink-0 flex-col p-[8px]" style={{ backgroundColor: "var(--bg-nav)" }} ref={userMenuRef}>
        <div
          className="flex w-full cursor-pointer items-center gap-[8px] rounded-[10px] p-[6px] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
          role="button" tabIndex={0}
          onClick={() => { setUserMenuOpen(!userMenuOpen); setThemeSubOpen(false); }}>
          <span className="flex size-[28px] shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[var(--fill-tsp-white-main)] text-[var(--text-muted)]">
            {userAvatar ? (
              <img src={userAvatar} alt={userName} width={28} height={28}
                className="size-full rounded-[6px] object-cover" />
            ) : (<UserIcon size={14} />)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[13px] font-medium leading-[18px] text-[var(--text-primary)]">{userName}</span>
            <span className="truncate text-[11px] leading-[15px] text-[var(--text-tertiary)]">{userName}@bcagent.com</span>
          </div>
          <span className={cn("shrink-0 text-[var(--text-muted)] transition-transform", userMenuOpen && "rotate-180")}>
            <ChevronDownIcon size={12} />
          </span>
        </div>

        {/* 弹出菜单（参考 Trae 用户菜单风格） */}
        {userMenuOpen && (
          <div
            className="absolute bottom-full left-[8px] right-[8px] mb-[4px] overflow-hidden rounded-[12px] border-[0.5px] py-[6px] shadow-lg"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-main)",
            }}
          >
            {/* 用户信息头 */}
            <div className="flex items-center gap-[10px] px-[14px] py-[10px]">
              <span className="flex size-[32px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[var(--fill-tsp-white-main)] text-[var(--text-muted)]">
                {userAvatar ? (
                  <img src={userAvatar} alt={userName} width={32} height={32}
                    className="size-full rounded-[8px] object-cover" />
                ) : (<UserIcon size={16} />)}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[1px]">
                <span className="truncate text-[13px] font-medium leading-[18px] text-[var(--text-primary)]">{userName}</span>
                <span className="truncate text-[11px] leading-[15px] text-[var(--text-tertiary)]">{userName}@bcagent.com</span>
              </div>
            </div>

            <div className="mx-[14px] my-[4px] border-t-[0.5px]" style={{ borderColor: "var(--border-main)" }} />

            {/* 主题切换 */}
            <div
              className="flex cursor-pointer items-center justify-between px-[14px] py-[8px] text-[13px] leading-[20px] text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
              onClick={() => setThemeSubOpen(!themeSubOpen)}
            >
              <div className="flex items-center gap-[8px]">
                <span className="flex size-[18px] items-center justify-center text-[var(--text-secondary)]">
                  {theme === "light" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
                </span>
                <span>{theme === "light" ? "亮色模式" : "暗色模式"}</span>
              </div>
              <span className={cn("text-[var(--text-muted)] transition-transform", themeSubOpen && "rotate-180")}>
                <ChevronDownIcon size={12} />
              </span>
            </div>

            {themeSubOpen && (
              <div className="mx-[14px] mb-[2px] overflow-hidden rounded-[8px]" style={{ backgroundColor: "var(--fill-tsp-white-light)" }}>
                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-[8px] px-[12px] py-[6px] text-[13px] leading-[20px] transition-colors rounded-[6px] m-[4px]",
                    theme === "light" ? "bg-[var(--bg-card)] text-[var(--color-primary)] font-medium shadow-sm" : "text-[var(--text-primary)] hover:bg-[var(--fill-tsp-white-main)]"
                  )}
                  onClick={() => { if (theme !== "light") onToggleTheme?.(); }}
                >
                  <span className="flex size-[18px] items-center justify-center">
                    <SunIcon size={16} />
                  </span>
                  亮色
                </div>
                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-[8px] px-[12px] py-[6px] text-[13px] leading-[20px] transition-colors rounded-[6px] m-[4px]",
                    theme === "dark" ? "bg-[var(--bg-card)] text-[var(--color-primary)] font-medium shadow-sm" : "text-[var(--text-primary)] hover:bg-[var(--fill-tsp-white-main)]"
                  )}
                  onClick={() => { if (theme !== "dark") onToggleTheme?.(); }}
                >
                  <span className="flex size-[18px] items-center justify-center">
                    <MoonIcon size={16} />
                  </span>
                  暗色
                </div>
              </div>
            )}

            <div className="mx-[14px] my-[4px] border-t-[0.5px]" style={{ borderColor: "var(--border-main)" }} />

            {/* 设置 */}
            <div
              className="flex cursor-pointer items-center gap-[8px] px-[14px] py-[8px] text-[13px] leading-[20px] text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
              onClick={() => { setUserMenuOpen(false); onOpenSettings?.(); }}
            >
              <span className="flex size-[18px] items-center justify-center text-[var(--text-secondary)]">
                <SettingsIcon size={16} />
              </span>
              设置
            </div>

            {/* 退出登录 */}
            <div
              className="flex cursor-pointer items-center gap-[8px] px-[14px] py-[8px] text-[13px] leading-[20px] text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
              onClick={() => { setUserMenuOpen(false); alert("【演示】退出登录"); }}
            >
              <span className="flex size-[18px] items-center justify-center text-[var(--text-secondary)]">
                <LogoutIcon size={16} />
              </span>
              退出登录
            </div>
          </div>
        )}
      </div>

      {/* 新建工作事项弹窗 */}
      <CreateProjectModal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        userName={userName}
      />

      {/* 会话操作下拉菜单（三点菜单） */}
      {convMenuOpen && operatingConv && (
        <>
          <div className="fixed inset-0 z-40" onClick={closeConvMenu} />
          <div
            className="fixed z-50 w-[140px] overflow-hidden rounded-[10px] border-[0.5px] py-[4px] shadow-md"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-main)",
              /* 简单定位：在侧栏右侧弹出 */
              left: "310px",
              top: "50%",
            }}
          >
            <div
              onClick={handleRename}
              className="flex cursor-pointer items-center gap-[8px] px-[12px] py-[8px] text-[13px] leading-[20px] text-[var(--text-primary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
            >
              重命名
            </div>
            <div
              onClick={handleDeleteConfirm}
              className="flex cursor-pointer items-center gap-[8px] px-[12px] py-[8px] text-[13px] leading-[20px] text-[var(--color-error)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-error)_6%,transparent)]"
            >
              删除
            </div>
          </div>
        </>
      )}

      {/* 重命名弹窗 */}
      {renameModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          onClick={() => { setRenameModalOpen(false); setOperatingConv(null); }}
        >
          <div
            className="mx-4 w-full max-w-[360px] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-main)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-[0.5px] px-[20px] py-[16px]" style={{ borderColor: "var(--border-main)" }}>
              <h3 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">重命名会话</h3>
              <button
                type="button"
                onClick={() => { setRenameModalOpen(false); setOperatingConv(null); }}
                className="flex size-[28px] cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-light)]"
              >
                ✕
              </button>
            </div>
            <div className="p-[20px]">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmRename(); }}
                autoFocus
                placeholder="输入新的会话名称"
                className="h-[36px] w-full rounded-[8px] border-[0.5px] px-[12px] text-[13px] text-[var(--text-primary)] outline-none"
                style={{ backgroundColor: "var(--bg-main)", borderColor: "var(--border-main)" }}
              />
            </div>
            <div className="flex border-t-[0.5px]" style={{ borderColor: "var(--border-main)" }}>
              <button
                onClick={() => { setRenameModalOpen(false); setOperatingConv(null); }}
                className="flex-1 h-[44px] cursor-pointer border-none bg-transparent text-[14px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
              >
                取消
              </button>
              <div className="w-[0.5px] self-stretch" style={{ backgroundColor: "var(--border-main)" }} />
              <button
                onClick={confirmRename}
                disabled={!renameValue.trim()}
                className="flex-1 h-[44px] cursor-pointer border-none bg-transparent text-[14px] font-medium text-[var(--color-primary)] hover:bg-[var(--fill-tsp-white-light)] disabled:opacity-40"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deleteConfirmOpen && operatingConv && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          onClick={() => { setDeleteConfirmOpen(false); setOperatingConv(null); }}
        >
          <div
            className="mx-4 w-full max-w-[360px] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
            style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-main)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-[24px] text-center">
              <h4 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">删除会话</h4>
              <p className="m-0 mt-[8px] text-[13px] leading-[20px] text-[var(--text-secondary)]">
                确定要删除会话「{operatingConv.title}」吗？删除后可在 30 天备份期内由管理员恢复。
              </p>
            </div>
            <div className="flex border-t-[0.5px]" style={{ borderColor: "var(--border-main)" }}>
              <button
                onClick={() => { setDeleteConfirmOpen(false); setOperatingConv(null); }}
                className="flex-1 h-[44px] cursor-pointer border-none bg-transparent text-[14px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
              >
                取消
              </button>
              <div className="w-[0.5px] self-stretch" style={{ backgroundColor: "var(--border-main)" }} />
              <button
                onClick={confirmDelete}
                className="flex-1 h-[44px] cursor-pointer border-none bg-transparent text-[14px] font-medium text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_6%,transparent)]"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
