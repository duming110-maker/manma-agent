"use client";

/**
 * BC Agent 定时任务页 —— 模板 / 任务管理 / 执行记录
 *
 * 变更记录：
 * - 2026-07-03 | 初始化定时任务页面（产品方案 V1.1 第六章）
 *
 * 设计参考：
 * - 布局结构：doc/bcagent-product-proposal-v1.1.md 第六章「定时任务」
 * - 视觉风格：https://work.trae.cn/automation（tab 底边线、模板卡片、空状态、创建按钮）
 * - 色彩体系：BC Agent 暖灰色系（严格复用 CSS 变量）
 *
 * 页面结构：
 * ┌──────────────────────────────────────────────────────────┐
 * │  定时任务                                    [创建定时任务] │
 * │  配置和管理自动化任务，让 AI 按计划执行工作流              │
 * │  ┌────────────────────────────────────────────────────┐  │
 * │  │ [定时任务模板] [任务] [执行记录]                     │  │
 * │  ├────────────────────────────────────────────────────┤  │
 * │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐           │  │
 * │  │  │ 🕐 模板1 │ │  模板2   │ │  模板3   │           │  │
 * │  │  │   描述   │ │  描述    │ │  描述    │           │  │
 * │  │  └──────────┘ └──────────┘ └──────────┘           │  │
 * │  └────────────────────────────────────────────────────┘  │
 * └──────────────────────────────────────────────────────────┘
 *
 * 三个选项卡：
 * 1. 定时任务模板 — 预设模板卡片网格，点击弹出创建表单（预填）
 * 2. 任务 — 已创建的任务列表，含启用/停用开关、编辑/删除/手动触发
 * 3. 执行记录 — 历史执行记录，含状态、耗时、点击查看详情
 */

import { CronIcon, PlusIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import React, { useCallback, useState } from "react";

/* ================================================================
 *  类型定义
 * ================================================================ */

type CronTab = "template" | "tasks" | "history";

/** 定时任务模板 */
interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  /** 预设的触发频率 */
  defaultFrequency: "每天" | "每周" | "每月" | "间隔触发";
  /** 预设时间 */
  defaultTime: string;
  /** 预设 prompt 内容 */
  defaultPrompt: string;
}

/** 已创建的定时任务 */
interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  frequency: string;
  time: string;
  model: string;
  projectName?: string;
  enabled: boolean;
  createdAt: string;
  lastRunAt?: string;
  nextRunAt: string;
}

/** 执行记录 */
interface ExecutionRecord {
  id: string;
  taskName: string;
  executedAt: string;
  status: "success" | "failed" | "running";
  duration: string;
  /** 展开后的对话内容 */
  conversation?: string;
}

interface CronPageProps {
  /** 跳转到会话页 */
  onNavigateToChat?: () => void;
}

/* ================================================================
 *  模拟数据
 * ================================================================ */

const MOCK_TEMPLATES: TaskTemplate[] = [
  {
    id: "tpl-1",
    name: "每日催收数据汇总",
    description: "每天早上自动汇总前一天的催收数据，分析逾期率变化并生成简报",
    defaultFrequency: "每天",
    defaultTime: "09:00",
    defaultPrompt: "请分析昨天的催收数据，汇总各阶段的逾期率变化，识别异常波动，生成一份简报。",
  },
  {
    id: "tpl-2",
    name: "风控审批周报",
    description: "每周一自动统计上周风控审批情况，汇总通过率、拒绝原因分布",
    defaultFrequency: "每周",
    defaultTime: "08:00",
    defaultPrompt: "请统计上周风控审批数据，汇总审批通过率、各拒绝原因的比例分布，对比前一周的变化趋势。",
  },
  {
    id: "tpl-3",
    name: "合规月度检查",
    description: "每月1号自动检查上月的业务操作合规性，标记潜在风险",
    defaultFrequency: "每月",
    defaultTime: "08:30",
    defaultPrompt: "请检查上月的业务操作记录，对照合规要求逐项核查，标记任何不符合规范的操作并给出整改建议。",
  },
  {
    id: "tpl-4",
    name: "客户还款提醒",
    description: "每天下午检查次日应还款客户清单，自动生成提醒通知草稿",
    defaultFrequency: "每天",
    defaultTime: "16:00",
    defaultPrompt: "请检查明天应还款的客户清单，按逾期风险排序，为高风险客户生成还款提醒通知草稿。",
  },
  {
    id: "tpl-5",
    name: "房产估值监控",
    description: "每周更新抵押房产的估值变动，标记超出阈值的异常波动",
    defaultFrequency: "每周",
    defaultTime: "10:00",
    defaultPrompt: "请更新所有抵押房产的最新估值，对比上次评估结果，标记跌幅超过5%的房产并分析原因。",
  },
];

const MOCK_TASKS: ScheduledTask[] = [
  {
    id: "task-1",
    name: "每日催收数据汇总",
    description: "每天早上自动汇总前一天的催收数据，分析逾期率变化并生成简报",
    frequency: "每天",
    time: "09:00",
    model: "DeepSeek-V4-Flash",
    projectName: "催收工作事项",
    enabled: true,
    createdAt: "2026-06-20",
    lastRunAt: "2026-07-03 09:00",
    nextRunAt: "2026-07-04 09:00",
  },
  {
    id: "task-2",
    name: "风控审批周报",
    description: "每周一统计上周风控审批情况",
    frequency: "每周",
    time: "08:00",
    model: "DeepSeek-V4-Pro",
    enabled: true,
    createdAt: "2026-06-15",
    lastRunAt: "2026-07-01 08:00",
    nextRunAt: "2026-07-08 08:00",
  },
  {
    id: "task-3",
    name: "合规月度检查",
    description: "每月1号检查上月业务操作合规性",
    frequency: "每月",
    time: "08:30",
    model: "Claude-Opus-4.8",
    enabled: false,
    createdAt: "2026-05-10",
    lastRunAt: "2026-07-01 08:30",
    nextRunAt: "2026-08-01 08:30",
  },
];

const MOCK_HISTORY: ExecutionRecord[] = [
  {
    id: "hist-1",
    taskName: "每日催收数据汇总",
    executedAt: "2026-07-03 09:00",
    status: "success",
    duration: "2分35秒",
  },
  {
    id: "hist-2",
    taskName: "每日催收数据汇总",
    executedAt: "2026-07-02 09:00",
    status: "success",
    duration: "2分18秒",
  },
  {
    id: "hist-3",
    taskName: "风控审批周报",
    executedAt: "2026-07-01 08:00",
    status: "success",
    duration: "5分42秒",
  },
  {
    id: "hist-4",
    taskName: "合规月度检查",
    executedAt: "2026-07-01 08:30",
    status: "failed",
    duration: "1分03秒",
  },
];

/* ================================================================
 *  子组件
 * ================================================================ */

/**
 * Tab 按钮（与 SkillsPage TabButton 一致）
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
    {badge !== undefined && badge > 0 && (
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
    {active && (
      <span
        className="absolute bottom-0 left-0 right-0 h-[2px] rounded-t-[1px]"
        style={{ backgroundColor: "var(--color-primary)" }}
      />
    )}
  </button>
);

/**
 * 模板卡片 —— 网格布局
 */
const TemplateCard: React.FC<{
  template: TaskTemplate;
  onClick: (template: TaskTemplate) => void;
}> = ({ template, onClick }) => (
  <div
    onClick={() => onClick(template)}
    className="flex cursor-pointer flex-col gap-[16px] rounded-[12px] border-[0.5px] p-[16px] transition-all duration-200 hover:-translate-y-[2px]"
    style={{
      backgroundColor: "var(--bg-card)",
      borderColor: "var(--border-main)",
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = "var(--shadow-md)";
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = "none";
    }}
  >
    {/* 图标 + 频率标签 */}
    <div className="flex items-center justify-between">
      <div
        className="flex size-[48px] shrink-0 items-center justify-center rounded-[4px]"
        style={{
          backgroundColor: "color-mix(in srgb, var(--color-primary) 8%, transparent)",
          color: "var(--color-primary)",
        }}
      >
        <CronIcon size={24} />
      </div>
      <span
        className="rounded-[4px] px-[8px] py-[2px] text-[11px] leading-[18px] font-medium"
        style={{
          backgroundColor: "var(--fill-tsp-white-light)",
          color: "var(--text-tertiary)",
        }}
      >
        {template.defaultFrequency} · {template.defaultTime}
      </span>
    </div>

    {/* 名称 + 描述 */}
    <div className="flex flex-col gap-[4px]">
      <span className="text-[13px] leading-[20px] font-medium text-[var(--text-primary)]">
        {template.name}
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
        {template.description}
      </span>
    </div>

    {/* 底部：使用模板按钮 */}
    <span className="text-[12px] font-medium text-[var(--color-primary)] hover:underline">
      使用此模板 →
    </span>
  </div>
);

/**
 * 任务列表行
 *
 * 交互：切换启用/停用、编辑、删除、手动触发
 */
const TaskRow: React.FC<{
  task: ScheduledTask;
  onToggle: (id: string) => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onTrigger: () => void;
}> = ({ task, onToggle, onEdit, onDelete, onTrigger }) => (
  <div
    className="flex items-center gap-[16px] rounded-[12px] border-[0.5px] p-[16px] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
    style={{
      backgroundColor: "var(--bg-card)",
      borderColor: "var(--border-main)",
    }}
  >
    {/* 启用/停用开关 */}
    <button
      type="button"
      onClick={() => onToggle(task.id)}
      className={cn(
        "relative flex h-[24px] w-[44px] shrink-0 cursor-pointer items-center rounded-full border-none transition-colors",
        task.enabled
          ? "bg-[var(--color-primary)]"
          : "bg-[var(--border-dark)]"
      )}
      style={{ backgroundColor: task.enabled ? "var(--color-primary)" : "rgba(0,0,0,0.15)" }}
    >
      <span
        className={cn(
          "size-[18px] rounded-full bg-white shadow-sm transition-transform",
          task.enabled ? "translate-x-[22px]" : "translate-x-[3px]"
        )}
      />
    </button>

    {/* 任务信息 */}
    <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
      <div className="flex items-center gap-[8px]">
        <span className="text-[13px] leading-[20px] font-medium text-[var(--text-primary)]">
          {task.name}
        </span>
        {!task.enabled && (
          <span className="rounded-[4px] bg-[var(--fill-tsp-white-main)] px-[6px] py-[1px] text-[10px] font-medium text-[var(--text-tertiary)]">
            已停用
          </span>
        )}
      </div>
      <span className="text-[12px] leading-[18px] text-[var(--text-secondary)]">
        {task.frequency} · {task.time} · {task.model}
        {task.projectName && ` · ${task.projectName}`}
      </span>
    </div>

    {/* 下次执行时间 */}
    <div className="hidden shrink-0 flex-col items-end gap-[2px] sm:flex">
      <span className="text-[11px] leading-[16px] text-[var(--text-tertiary)]">
        下次执行
      </span>
      <span className="text-[12px] leading-[16px] font-medium text-[var(--text-primary)]">
        {task.nextRunAt}
      </span>
    </div>

    {/* 操作按钮 */}
    <div className="flex shrink-0 items-center gap-[4px]">
      {/* 手动触发 */}
      <button
        type="button"
        onClick={() => onTrigger()}
        disabled={!task.enabled}
        className="flex h-[28px] cursor-pointer items-center rounded-[4px] border-none bg-transparent px-[8px] text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-main)] disabled:cursor-not-allowed disabled:opacity-30"
        title="手动执行一次"
      >
        执行
      </button>
      {/* 编辑 */}
      <button
        type="button"
        onClick={() => onEdit()}
        className="flex h-[28px] cursor-pointer items-center rounded-[4px] border-none bg-transparent px-[8px] text-[11px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-main)]"
      >
        编辑
      </button>
      {/* 删除 */}
      <button
        type="button"
        onClick={() => onDelete(task.id)}
        className="flex h-[28px] cursor-pointer items-center rounded-[4px] border-none bg-transparent px-[8px] text-[11px] font-medium text-[var(--color-error)] transition-colors hover:bg-[color-mix(in_srgb,var(--color-error)_8%,transparent)]"
      >
        删除
      </button>
    </div>
  </div>
);

/**
 * 执行记录行
 */
const HistoryRow: React.FC<{
  record: ExecutionRecord;
  onClick: (record: ExecutionRecord) => void;
}> = ({ record, onClick }) => (
  <div
    onClick={() => onClick(record)}
    className="flex cursor-pointer items-center gap-[16px] rounded-[12px] border-[0.5px] p-[16px] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
    style={{
      backgroundColor: "var(--bg-card)",
      borderColor: "var(--border-main)",
    }}
  >
    {/* 状态图标 */}
    <span
      className={cn(
        "flex size-[32px] shrink-0 items-center justify-center rounded-full text-[14px]",
        record.status === "success" && "text-[var(--color-success)]",
        record.status === "failed" && "text-[var(--color-error)]",
        record.status === "running" && "text-[var(--color-primary)]"
      )}
      style={{
        backgroundColor:
          record.status === "success"
            ? "color-mix(in srgb, var(--color-success) 10%, transparent)"
            : record.status === "failed"
              ? "color-mix(in srgb, var(--color-error) 10%, transparent)"
              : "color-mix(in srgb, var(--color-primary) 10%, transparent)",
      }}
    >
      {record.status === "success" ? "✓" : record.status === "failed" ? "✗" : "⟳"}
    </span>

    {/* 记录信息 */}
    <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
      <span className="text-[13px] leading-[20px] font-medium text-[var(--text-primary)]">
        {record.taskName}
      </span>
      <span className="text-[12px] leading-[18px] text-[var(--text-secondary)]">
        {record.executedAt}
      </span>
    </div>

    {/* 耗时 + 状态 */}
    <div className="flex shrink-0 items-center gap-[12px]">
      <span className="text-[12px] leading-[16px] text-[var(--text-tertiary)]">
        {record.duration}
      </span>
      <span
        className={cn(
          "rounded-[4px] px-[8px] py-[2px] text-[11px] leading-[16px] font-medium",
          record.status === "success" && "text-[var(--color-success)]",
          record.status === "failed" && "text-[var(--color-error)]",
          record.status === "running" && "text-[var(--color-primary)]"
        )}
        style={{
          backgroundColor:
            record.status === "success"
              ? "color-mix(in srgb, var(--color-success) 8%, transparent)"
              : record.status === "failed"
                ? "color-mix(in srgb, var(--color-error) 8%, transparent)"
                : "color-mix(in srgb, var(--color-primary) 8%, transparent)",
        }}
      >
        {record.status === "success" ? "成功" : record.status === "failed" ? "失败" : "运行中"}
      </span>
    </div>
  </div>
);

/**
 * 创建定时任务弹窗（对齐产品方案 V1.2 第六章表单）
 *
 * V1.2 更新：
 * - 触发频率与执行时间分离为两个独立字段
 * - 选择「每周」时显示重复日多选（周一至周日）
 * - 选择「每月」时显示执行日下拉（1-28日）
 * - 新增开始日期、截止日期字段
 * - 新增技能选择字段
 */
const CreateTaskModal: React.FC<{
  open: boolean;
  onClose: () => void;
  /** 预填数据（从模板创建时传入） */
  prefill?: TaskTemplate;
}> = ({ open, onClose, prefill }) => {
  const [form, setForm] = useState({
    name: prefill?.name ?? "",
    frequency: prefill?.defaultFrequency ?? "每天",
    /** 周重复日：多选，如 ["周一","周三","周五"] */
    weekDays: [] as string[],
    /** 月执行日：1-28 */
    monthDay: 1,
    time: prefill?.defaultTime ?? "09:00",
    startDate: "",
    endDate: "",
    description: prefill?.defaultPrompt ?? "",
    model: "DeepSeek-V4-Flash",
    project: "",
    /** 已选技能名称列表 */
    skills: [] as string[],
    skipConfirm: false,
  });

  // 弹窗关闭时重置表单
  React.useEffect(() => {
    if (open) {
      setForm({
        name: prefill?.name ?? "",
        frequency: prefill?.defaultFrequency ?? "每天",
        weekDays: [],
        monthDay: 1,
        time: prefill?.defaultTime ?? "09:00",
        startDate: "",
        endDate: "",
        description: prefill?.defaultPrompt ?? "",
        model: "DeepSeek-V4-Flash",
        project: "",
        skills: [],
        skipConfirm: false,
      });
    }
  }, [open, prefill]);

  /** 切换周重复日 */
  const toggleWeekDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      weekDays: prev.weekDays.includes(day)
        ? prev.weekDays.filter((d) => d !== day)
        : [...prev.weekDays, day],
    }));
  };

  /** 切换技能选择 */
  const toggleSkill = (skillName: string) => {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.includes(skillName)
        ? prev.skills.filter((s) => s !== skillName)
        : [...prev.skills, skillName],
    }));
  };

  const WEEK_DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const MONTH_DAYS = Array.from({ length: 28 }, (_, i) => i + 1);

  /** 模拟可供选择的技能列表 */
  const availableSkills = [
    "催收话术策略",
    "风控审批辅助",
    "房产核值辅助",
    "贷后监控报告",
    "数据分析助手",
    "文档智能处理",
  ];

  if (!open) return null;

  return (
    /* 遮罩层（点击空白不关闭，防止输入内容丢失） */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
    >
      {/* 弹窗主体 */}
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
            {prefill ? "从模板创建定时任务" : "创建定时任务"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-[28px] cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-[var(--text-muted)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
          >
            ✕
          </button>
        </div>

        {/* 表单内容（可滚动） */}
        <div className="flex-1 overflow-y-auto px-[24px] py-[20px]">
          <div className="flex flex-col gap-[16px]">
            {/* 任务名称 */}
            <label className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                任务名称 <span className="text-[var(--color-error)]">*</span>
              </span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="自定义任务名称"
                className="h-[36px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                style={{
                  backgroundColor: "var(--bg-main)",
                  borderColor: "var(--border-main)",
                }}
              />
            </label>

            {/* 触发频率 */}
            <div className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                触发频率
              </span>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value as TaskTemplate["defaultFrequency"] })}
                className="h-[36px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-main)",
                  borderColor: "var(--border-main)",
                }}
              >
                <option value="每天">每天</option>
                <option value="每周">每周</option>
                <option value="每月">每月</option>
                <option value="间隔触发">间隔触发</option>
              </select>
            </div>

            {/* 选择「每周」时：重复日多选 */}
            {form.frequency === "每周" && (
              <div className="flex flex-col gap-[6px]">
                <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                  重复日 <span className="text-[var(--color-error)]">*</span>
                </span>
                <div className="flex flex-wrap gap-[6px]">
                  {WEEK_DAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeekDay(day)}
                      className="flex h-[28px] cursor-pointer items-center rounded-[6px] border-[0.5px] px-[10px] text-[12px] leading-[18px] transition-colors"
                      style={{
                        backgroundColor: form.weekDays.includes(day)
                          ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                          : "var(--bg-main)",
                        borderColor: form.weekDays.includes(day)
                          ? "var(--color-primary)"
                          : "var(--border-main)",
                        color: form.weekDays.includes(day)
                          ? "var(--color-primary)"
                          : "var(--text-secondary)",
                      }}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 选择「每月」时：执行日下拉 */}
            {form.frequency === "每月" && (
              <div className="flex flex-col gap-[6px]">
                <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                  执行日
                </span>
                <select
                  value={form.monthDay}
                  onChange={(e) => setForm({ ...form, monthDay: Number(e.target.value) })}
                  className="h-[36px] w-[120px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    borderColor: "var(--border-main)",
                  }}
                >
                  {MONTH_DAYS.map((d) => (
                    <option key={d} value={d}>{d}日</option>
                  ))}
                </select>
                <span className="text-[11px] text-[var(--text-muted)]">
                  每月 29-31 日不保证所有月份都有，建议选择 1-28 日
                </span>
              </div>
            )}

            {/* 执行时间 */}
            <div className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                执行时间
              </span>
              <select
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="h-[36px] w-[120px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none cursor-pointer"
                style={{
                  backgroundColor: "var(--bg-main)",
                  borderColor: "var(--border-main)",
                }}
              >
                {Array.from({ length: 24 }, (_, i) => {
                  const h = String(i).padStart(2, "0");
                  return [
                    <option key={`${h}:00`} value={`${h}:00`}>{`${h}:00`}</option>,
                    <option key={`${h}:30`} value={`${h}:30`}>{`${h}:30`}</option>,
                  ];
                }).flat()}
              </select>
            </div>

            {/* 开始日期 + 截止日期 */}
            <div className="grid grid-cols-2 gap-[12px]">
              <label className="flex flex-col gap-[6px]">
                <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                  开始日期
                </span>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="h-[36px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    borderColor: "var(--border-main)",
                  }}
                />
                <span className="text-[11px] text-[var(--text-muted)]">不填则从创建日起生效</span>
              </label>
              <label className="flex flex-col gap-[6px]">
                <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                  截止日期
                </span>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="h-[36px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    borderColor: "var(--border-main)",
                  }}
                />
                <span className="text-[11px] text-[var(--text-muted)]">不填则不限截止时间</span>
              </label>
            </div>

            {/* 描述/Prompt */}
            <label className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                任务描述
              </span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="输入任务描述，告诉 AI 每次触发时需要做什么..."
                rows={4}
                className="min-h-[100px] resize-y rounded-[8px] border-[0.5px] p-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--color-primary)]"
                style={{
                  backgroundColor: "var(--bg-main)",
                  borderColor: "var(--border-main)",
                }}
              />
            </label>

            {/* 模型 + 工作事项 */}
            <div className="grid grid-cols-2 gap-[12px]">
              <div className="flex flex-col gap-[6px]">
                <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                  模型选择
                </span>
                <select
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  className="h-[36px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    borderColor: "var(--border-main)",
                  }}
                >
                  <option value="DeepSeek-V4-Flash">DeepSeek-V4-Flash</option>
                  <option value="DeepSeek-V4-Pro">DeepSeek-V4-Pro</option>
                  <option value="Claude-Opus-4.8">Claude-Opus-4.8</option>
                  <option value="通义千问-Max">通义千问-Max</option>
                </select>
              </div>
              <div className="flex flex-col gap-[6px]">
                <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                  工作事项选择
                </span>
                <select
                  value={form.project}
                  onChange={(e) => setForm({ ...form, project: e.target.value })}
                  className="h-[36px] rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] text-[var(--text-primary)] outline-none cursor-pointer"
                  style={{
                    backgroundColor: "var(--bg-main)",
                    borderColor: "var(--border-main)",
                  }}
                >
                  <option value="">选择工作事项(可选)</option>
                  <option value="催收工作事项">催收工作事项</option>
                  <option value="风控分析">风控分析</option>
                </select>
              </div>
            </div>

            {/* 技能选择（多选） */}
            <div className="flex flex-col gap-[6px]">
              <span className="text-[13px] leading-[18px] font-medium text-[var(--text-primary)]">
                技能选择
              </span>
              <div className="flex flex-wrap gap-[6px]">
                {availableSkills.map((skill) => (
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
              {form.project && (
                <span className="text-[11px] text-[var(--text-muted)]">
                  已选择工作事项，仅显示该工作事项绑定的技能
                </span>
              )}
            </div>

            {/* 跳过确认 */}
            <label className="flex items-center gap-[10px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.skipConfirm}
                onChange={(e) => setForm({ ...form, skipConfirm: e.target.checked })}
                className="size-[16px] cursor-pointer rounded-[4px] accent-[var(--color-primary)]"
              />
              <span className="text-[13px] leading-[20px] text-[var(--text-secondary)]">
                执行前无需人工确认（跳过确认）
              </span>
            </label>
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          className="flex shrink-0 items-center justify-end gap-[8px] border-t-[0.5px] px-[24px] py-[16px]"
          style={{ borderColor: "var(--border-main)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex h-[32px] cursor-pointer items-center rounded-[8px] border-[0.5px] border-[var(--border-main)] bg-transparent px-[16px] text-[13px] leading-[20px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              alert("【演示】定时任务创建成功！");
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
 *  主组件
 * ================================================================ */

const CronPage: React.FC<CronPageProps> = ({ onNavigateToChat }) => {
  /* ---- 状态 ---- */
  const [activeTab, setActiveTab] = useState<CronTab>("template");
  const [tasks, setTasks] = useState<ScheduledTask[]>(MOCK_TASKS);
  const [history] = useState<ExecutionRecord[]>(MOCK_HISTORY);

  /* 创建弹窗 */
  const [modalOpen, setModalOpen] = useState(false);
  const [prefillTemplate, setPrefillTemplate] = useState<TaskTemplate | undefined>();

  /* 执行记录详情的 modal */
  const [selectedRecord, setSelectedRecord] = useState<ExecutionRecord | null>(null);

  /* ---- 操作回调 ---- */

  /** 从模板创建 */
  const handleTemplateClick = useCallback((template: TaskTemplate) => {
    setPrefillTemplate(template);
    setModalOpen(true);
  }, []);

  /** 空白创建 */
  const handleCreate = useCallback(() => {
    setPrefillTemplate(undefined);
    setModalOpen(true);
  }, []);

  /** 切换启用/停用 */
  const handleToggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  }, []);

  /** 编辑任务 */
  const handleEditTask = useCallback(() => {
    alert("【演示】编辑任务功能");
  }, []);

  /** 删除任务 */
  const handleDeleteTask = useCallback((id: string) => {
    if (confirm("确定要删除这个定时任务吗？此操作不可恢复。")) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      alert("【演示】任务已删除（30天备份期内可由管理员恢复）");
    }
  }, []);

  /** 手动触发 */
  const handleTriggerTask = useCallback(() => {
    alert("【演示】任务已手动触发，请查看执行记录");
  }, []);

  /** 点击执行记录 */
  const handleHistoryClick = useCallback((record: ExecutionRecord) => {
    setSelectedRecord(record);
  }, []);

  /* ---- 派生数据 ---- */
  const taskCount = tasks.length;
  const historyCount = history.length;

  /* ================================================================
   *  渲染
   * ================================================================ */

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      {/* ===== 页面标题区 ===== */}
      <div className="flex shrink-0 items-center justify-between px-[40px] pt-[44px] pb-[12px]">
        <div className="flex flex-col gap-[4px]">
          <h1 className="m-0 text-[24px] leading-[32px] font-semibold text-[var(--text-primary)] tracking-[0.1px]">
            定时任务
          </h1>
          <p className="m-0 text-[13px] leading-[20px] text-[var(--text-secondary)]">
            配置和管理自动化任务，让 AI 按计划执行工作流
          </p>
        </div>

        {/* 创建按钮 */}
        <button
          type="button"
          onClick={handleCreate}
          className="flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] border-none px-[12px] text-[14px] leading-[20px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--color-primary)" }}
        >
          <PlusIcon size={16} />
          <span>创建定时任务</span>
        </button>
      </div>

      {/* ===== Tab 栏 ===== */}
      <div
        className="flex shrink-0 items-center gap-[16px] border-b-[1px] px-[40px]"
        style={{ borderColor: "var(--border-main)" }}
      >
        <TabButton
          label="定时任务模板"
          active={activeTab === "template"}
          badge={MOCK_TEMPLATES.length}
          onClick={() => setActiveTab("template")}
        />
        <TabButton
          label="任务"
          active={activeTab === "tasks"}
          badge={taskCount}
          onClick={() => setActiveTab("tasks")}
        />
        <TabButton
          label="执行记录"
          active={activeTab === "history"}
          badge={historyCount}
          onClick={() => setActiveTab("history")}
        />
      </div>

      {/* ===== 内容区 ===== */}
      <div className="flex-1 overflow-y-auto px-[40px] py-[24px]">
        {/* ---------- 模板标签页 ---------- */}
        {activeTab === "template" && (
          <div className="grid grid-cols-1 gap-[16px] sm:grid-cols-2 lg:grid-cols-3">
            {MOCK_TEMPLATES.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                onClick={handleTemplateClick}
              />
            ))}
          </div>
        )}

        {/* ---------- 任务标签页 ---------- */}
        {activeTab === "tasks" && (
          <>
            {tasks.length > 0 ? (
              <div className="flex flex-col gap-[8px]">
                {tasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={handleToggleTask}
                    onEdit={handleEditTask}
                    onDelete={handleDeleteTask}
                    onTrigger={handleTriggerTask}
                  />
                ))}
              </div>
            ) : (
              /* 空状态 */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <span className="text-[48px]">⏰</span>
                <p className="mt-4 text-[14px] font-medium text-[var(--text-primary)]">
                  还没有定时任务
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  从模板快速创建或手动新建
                </p>
                <button
                  type="button"
                  onClick={handleCreate}
                  className="mt-4 flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] border-none px-[16px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)" }}
                >
                  <PlusIcon size={14} />
                  <span>创建定时任务</span>
                </button>
              </div>
            )}
          </>
        )}

        {/* ---------- 执行记录标签页 ---------- */}
        {activeTab === "history" && (
          <>
            {history.length > 0 ? (
              <div className="flex flex-col gap-[8px]">
                {history.map((record) => (
                  <HistoryRow
                    key={record.id}
                    record={record}
                    onClick={handleHistoryClick}
                  />
                ))}
              </div>
            ) : (
              /* 空状态 */
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <span className="text-[48px]">📋</span>
                <p className="mt-4 text-[14px] font-medium text-[var(--text-primary)]">
                  暂无执行记录
                </p>
                <p className="mt-1 text-[13px] text-[var(--text-muted)]">
                  创建定时任务后，每次执行都会记录在这里
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== 创建任务弹窗 ===== */}
      <CreateTaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        prefill={prefillTemplate}
      />

      {/* ===== 执行记录详情弹窗 ===== */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.4)" }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="mx-4 max-h-[80vh] w-full max-w-[560px] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
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
              <div className="flex flex-col gap-[2px]">
                <h3 className="m-0 text-[16px] leading-[24px] font-semibold text-[var(--text-primary)]">
                  {selectedRecord.taskName}
                </h3>
                <span className="text-[12px] text-[var(--text-secondary)]">
                  {selectedRecord.executedAt} · 耗时 {selectedRecord.duration}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="flex size-[28px] cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-[var(--text-muted)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
              >
                ✕
              </button>
            </div>
            {/* 内容 */}
            <div className="overflow-y-auto p-[24px]">
              <div
                className={cn(
                  "mb-4 rounded-[8px] px-[12px] py-[8px] text-[12px] font-medium",
                  selectedRecord.status === "success"
                    ? "text-[var(--color-success)]"
                    : "text-[var(--color-error)]"
                )}
                style={{
                  backgroundColor:
                    selectedRecord.status === "success"
                      ? "color-mix(in srgb, var(--color-success) 8%, transparent)"
                      : "color-mix(in srgb, var(--color-error) 8%, transparent)",
                }}
              >
                执行状态：{selectedRecord.status === "success" ? "成功" : "失败"}
              </div>
              <p className="m-0 text-[14px] leading-[22px] whitespace-pre-wrap text-[var(--text-primary)]">
                本次执行产生了完整对话记录。请前往「新建任务」页面查看具体对话内容。
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedRecord(null);
                  onNavigateToChat?.();
                }}
                className="mt-4 flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] border-none px-[16px] text-[13px] font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--color-primary)" }}
              >
                前往查看会话 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CronPage;
