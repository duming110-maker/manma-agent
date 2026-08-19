"use client";

/**
 * 可搜索多选下拉组件
 *
 * 变更履历：
 * - 2026-07-16 新建：替代原生 checkbox 列表，提供下拉+搜索的多选体验。
 *   用于工作事项分配范围、技能使用范围等场景。
 *
 * 设计规格：
 * - 触发按钮显示已选项数量（如「已选 3 项」）或占位文字
 * - 点击展开下拉面板：顶部搜索输入框 + 下方 checkbox 列表（按搜索词过滤）
 * - 点击面板外部自动关闭
 * - 支持全选/清空快捷操作
 */

import React, { useEffect, useRef, useState } from "react";

/** 选项数据结构 */
export interface SelectOption {
  value: number;
  label: string;
  /** 副标题（可选，如工号） */
  subtitle?: string;
}

interface SearchableMultiSelectProps {
  /** 全部可选选项 */
  options: SelectOption[];
  /** 已选中的值列表 */
  selected: number[];
  /** 选中变更回调 */
  onChange: (selected: number[]) => void;
  /** 占位文字 */
  placeholder?: string;
  /** 搜索框占位文字 */
  searchPlaceholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 面板最大高度 */
  maxHeight?: number;
}

const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  options,
  selected,
  onChange,
  placeholder = "请选择",
  searchPlaceholder = "搜索...",
  disabled = false,
  maxHeight = 200,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 点击外部关闭下拉 */
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  /** 打开时自动聚焦搜索框 */
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  /** 全选（当前过滤后的选项） */
  const selectAll = () => {
    const filteredValues = filteredOptions.map((o) => o.value);
    const merged = [...new Set([...selected, ...filteredValues])];
    onChange(merged);
  };

  /** 清空（当前过滤后的选项） */
  const clearAll = () => {
    const filteredValues = new Set(filteredOptions.map((o) => o.value));
    onChange(selected.filter((v) => !filteredValues.has(v)));
  };

  /** 按搜索词过滤 */
  const filteredOptions = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      (o.subtitle && o.subtitle.toLowerCase().includes(search.toLowerCase())),
  );

  /** 触发按钮文案 */
  const triggerText =
    selected.length > 0 ? `已选 ${selected.length} 项` : placeholder;

  return (
    <div ref={containerRef} className="relative">
      {/* 触发按钮 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) setOpen(!open); }}
        className="flex h-[36px] w-full cursor-pointer items-center justify-between rounded-[8px] border-[0.5px] px-[12px] text-[13px] leading-[20px] transition-colors hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          backgroundColor: "var(--bg-main)",
          borderColor: open ? "var(--color-primary)" : "var(--border-main)",
          color: selected.length > 0 ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span className="truncate">{triggerText}</span>
        {/* 下拉箭头 */}
        <svg
          className={`ml-[4px] size-[14px] shrink-0 text-[var(--text-muted)] transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* 下拉面板 */}
      {open && (
        <div
          className="absolute left-0 z-50 mt-[4px] w-full overflow-hidden rounded-[10px] border-[0.5px] shadow-lg"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border-main)",
          }}
        >
          {/* 搜索输入框 */}
          <div
            className="flex items-center gap-[6px] border-b-[0.5px] px-[10px] py-[8px]"
            style={{ borderColor: "var(--border-main)" }}
          >
            <svg
              className="size-[14px] shrink-0 text-[var(--text-muted)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex-1 border-none bg-transparent text-[13px] leading-[20px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              onKeyDown={(e) => e.stopPropagation()}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[4px] border-none bg-transparent text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-light)]"
              >
                ✕
              </button>
            )}
          </div>

          {/* 快捷操作栏 */}
          <div
            className="flex items-center gap-[8px] border-b-[0.5px] px-[10px] py-[6px]"
            style={{ borderColor: "var(--border-main)" }}
          >
            <button
              type="button"
              onClick={selectAll}
              className="cursor-pointer border-none bg-transparent text-[11px] text-[var(--color-primary)] hover:underline"
            >
              全选
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="cursor-pointer border-none bg-transparent text-[11px] text-[var(--text-muted)] hover:underline"
            >
              清空
            </button>
            <span className="ml-auto text-[11px] text-[var(--text-muted)]">
              {filteredOptions.length} 项
            </span>
          </div>

          {/* 选项列表 */}
          <div
            className="overflow-y-auto"
            style={{ maxHeight: `${maxHeight}px` }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-[12px] py-[16px] text-center text-[12px] text-[var(--text-muted)]">
                无匹配结果
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isChecked = selected.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-[8px] px-[10px] py-[7px] text-[13px] leading-[20px] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
                  >
                    {/* 自定义 checkbox */}
                    <span
                      className={`flex size-[15px] shrink-0 items-center justify-center rounded-[3px] border transition-colors ${
                        isChecked
                          ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                          : "border-[var(--border-main)] bg-transparent"
                      }`}
                    >
                      {isChecked && (
                        <svg
                          className="size-[11px] text-white"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="flex-1 truncate text-[var(--text-primary)]">
                      {option.label}
                    </span>
                    {option.subtitle && (
                      <span className="shrink-0 text-[11px] text-[var(--text-muted)]">
                        {option.subtitle}
                      </span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* 底部已选提示 */}
          {selected.length > 0 && (
            <div
              className="border-t-[0.5px] px-[10px] py-[6px] text-[11px] text-[var(--text-muted)]"
              style={{ borderColor: "var(--border-main)" }}
            >
              已选择 {selected.length} 项
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableMultiSelect;
