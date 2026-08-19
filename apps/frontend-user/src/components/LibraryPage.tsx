"use client";

/**
 * BC Agent 库页面 —— AI 产出文件集中展示
 *
 * 变更记录：
 * - 2026-07-07 | 初始化库页面（产品方案 V1.1 第七章）
 *
 * 设计参考：
 * - 布局结构：doc/bcagent-product-proposal-v1.1.md 第七章「库」
 * - 视觉风格：https://manus.im/app/library（文件卡片、会话分组、筛选搜索）
 * - 色彩体系：BC Agent 暖灰色系（严格复用 CSS 变量）
 *
 * 页面结构：
 * ┌──────────────────────────────────────────────────────────┐
 * │  库                                                       │
 * │  [全部] [我的收藏]    [全部类型 ▼]  🔍 搜索文件...        │
 * │  ┌────────────────────────────────────────────────────┐  │
 * │  │ 📁 会话标题1                         日期          │  │
 * │  │ ┌──────┐ ┌──────┐ ┌──────┐                        │  │
 * │  │ │ 🖼️   │ │ 📄   │ │ 📊   │  还有 2 个文件         │  │
 * │  │ │img1  │ │doc1  │ │sheet │                        │  │
 * │  │ │.png  │ │.docx │ │.xlsx │                        │  │
 * │  │ └──────┘ └──────┘ └──────┘                        │  │
 * │  ├────────────────────────────────────────────────────┤  │
 * │  │ 📁 会话标题2                                         │  │
 * │  │ ...                                                │  │
 * │  └────────────────────────────────────────────────────┘  │
 * └──────────────────────────────────────────────────────────┘
 *
 * 功能要点：
 * - 仅展示 AI 产出文件（不含用户上传的原始文件）
 * - 按会话分组，每组最多展示一行 3 个文件
 * - 图片显示缩略图，非图片以文件类型图标 + 文件名展示
 * - 类型筛选 + 名称搜索
 * - 滚动分页（演示用静态数据）
 */

import { cn } from "@/lib/utils";
import {
  SearchIcon,
  ChevronDownIcon,
  ImageIcon,
  FileIcon,
  SpreadsheetIcon,
  CodeIcon,
  FolderIcon,
  FolderOpenIcon,
  StarFilledIcon,
  StarIcon,
} from "@/components/icons";
import React, { useCallback, useMemo, useState } from "react";

/* ================================================================
 *  类型定义
 * ================================================================ */

/** 文件类型 */
type FileType = "image" | "document" | "spreadsheet" | "code" | "other";

/** 文件条目 */
interface LibraryFile {
  id: string;
  name: string;
  type: FileType;
  /** 文件大小 */
  size: string;
  /** 缩略图（图片类型用 emoji 占位演示） */
  thumbnail?: string;
}

/** 会话分组 */
interface FileGroup {
  id: string;
  /** 产生该文件的会话标题 */
  conversationTitle: string;
  /** 会话日期 */
  date: string;
  /** 是否收藏 */
  starred: boolean;
  files: LibraryFile[];
}

/* ================================================================
 *  模拟数据（来自 BC 业务场景）
 * ================================================================ */

const MOCK_FILE_GROUPS: FileGroup[] = [
  {
    id: "grp-1",
    conversationTitle: "关于催收策略的优化方案讨论",
    date: "2026-07-05",
    starred: true,
    files: [
      { id: "f1", name: "催收策略分析报告", type: "document", size: "1.2 MB" },
      { id: "f2", name: "逾期率趋势图", type: "image", size: "856 KB" },
      { id: "f3", name: "客户分层统计", type: "spreadsheet", size: "2.1 MB" },
      { id: "f4", name: "M3+ 逾期客户明细", type: "spreadsheet", size: "3.4 MB" },
      { id: "f5", name: "催收话术模板_v2", type: "document", size: "456 KB" },
    ],
  },
  {
    id: "grp-2",
    conversationTitle: "风控准入规则评审",
    date: "2026-07-03",
    starred: false,
    files: [
      { id: "f6", name: "准入规则对比表", type: "spreadsheet", size: "1.8 MB" },
      { id: "f7", name: "风险指标可视化", type: "image", size: "1.1 MB" },
      { id: "f8", name: "审批流程优化建议", type: "document", size: "632 KB" },
    ],
  },
  {
    id: "grp-3",
    conversationTitle: "房产抵押物估值分析",
    date: "2026-06-28",
    starred: true,
    files: [
      { id: "f9", name: "抵押物估值汇总", type: "spreadsheet", size: "2.5 MB" },
      { id: "f10", name: "周边成交价走势图", type: "image", size: "1.4 MB" },
      { id: "f11", name: "估值模型代码", type: "code", size: "128 KB" },
    ],
  },
  {
    id: "grp-4",
    conversationTitle: "贷后监控数据汇总",
    date: "2026-06-25",
    starred: false,
    files: [
      { id: "f12", name: "监控指标仪表盘", type: "image", size: "2.3 MB" },
      { id: "f13", name: "异常波动标记明细", type: "spreadsheet", size: "980 KB" },
      { id: "f14", name: "催收回款率分析", type: "image", size: "1.6 MB" },
      { id: "f15", name: "监控脚本", type: "code", size: "45 KB" },
    ],
  },
];

/* ================================================================
 *  常量
 * ================================================================ */

const FILE_TYPE_LABELS: Record<FileType, string> = {
  image: "图片",
  document: "文档",
  spreadsheet: "表格",
  code: "代码",
  other: "其他",
};

/** 文件类型 → SVG 图标组件（黑白线性风格，统一系统主题） */
const FILE_TYPE_ICON: Record<FileType, React.ReactNode> = {
  image: <ImageIcon size={36} />,
  document: <FileIcon size={36} />,
  spreadsheet: <SpreadsheetIcon size={36} />,
  code: <CodeIcon size={36} />,
  other: <FolderIcon size={36} />,
};

/** 文件类型 → 背景色（统一中性灰色调，与系统黑白主题一致） */
const FILE_TYPE_BG: Record<FileType, string> = {
  image: "var(--fill-tsp-white-light)",
  document: "var(--fill-tsp-white-light)",
  spreadsheet: "var(--fill-tsp-white-light)",
  code: "var(--fill-tsp-white-light)",
  other: "var(--fill-tsp-white-light)",
};

/* ================================================================
 *  子组件
 * ================================================================ */

/**
 * 文件类型筛选下拉
 */
const TypeFilter: React.FC<{
  value: FileType | "all";
  onChange: (value: FileType | "all") => void;
}> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);

  const options: { value: FileType | "all"; label: string }[] = [
    { value: "all", label: "全部类型" },
    { value: "image", label: "图片" },
    { value: "document", label: "文档" },
    { value: "spreadsheet", label: "表格" },
    { value: "code", label: "代码" },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-[28px] cursor-pointer items-center gap-[4px] rounded-[6px] border-[0.5px] bg-transparent px-[10px] text-[12px] leading-[18px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
        style={{ borderColor: "var(--border-main)" }}
      >
        <span>{options.find((o) => o.value === value)?.label}</span>
        <ChevronDownIcon size={10} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-20 mt-[4px] w-[140px] overflow-hidden rounded-[10px] border-[0.5px] py-[4px] shadow-md"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border-main)",
            }}
          >
            {options.map((opt) => (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "cursor-pointer px-[12px] py-[6px] text-[13px] leading-[20px] transition-colors hover:bg-[var(--fill-tsp-white-light)]",
                  opt.value === value
                    ? "font-medium text-[var(--color-primary)]"
                    : "text-[var(--text-primary)]"
                )}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/**
 * 文件卡片 —— 对齐 manus 设计：rounded-12px, border-[0.5px], clickable
 */
const FileCard: React.FC<{
  file: LibraryFile;
  onClick: (file: LibraryFile) => void;
}> = ({ file, onClick }) => (
  <div
    onClick={() => onClick(file)}
    className="group flex cursor-pointer flex-col overflow-hidden rounded-[12px] border-[0.5px] transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md"
    style={{
      backgroundColor: "var(--bg-card)",
      borderColor: "var(--border-main)",
    }}
  >
    {/* 预览区（图片显示缩略图占位，非图片显示类型图标） */}
    <div
      className="flex items-center justify-center"
      style={{
        height: "140px",
        backgroundColor: FILE_TYPE_BG[file.type],
      }}
    >
      {file.type === "image" ? (
        /* 图片缩略图占位（黑白线性图标） */
        <div className="flex flex-col items-center gap-[4px] text-[var(--text-tertiary)]">
          <ImageIcon size={40} />
          <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
            图表预览
          </span>
        </div>
      ) : (
        /* 非图片：文件类型图标（黑白线性 SVG） */
        <div className="flex flex-col items-center gap-[4px] text-[var(--text-tertiary)]">
          <span className="leading-none">
            {FILE_TYPE_ICON[file.type]}
          </span>
          <span className="text-[11px] font-medium text-[var(--text-tertiary)]">
            {FILE_TYPE_LABELS[file.type]}
          </span>
        </div>
      )}
    </div>

    {/* 文件信息 */}
    <div
      className="flex items-center gap-[8px] px-[12px] py-[10px]"
      style={{ borderTop: "1px solid var(--border-main)" }}
    >
      <span className="min-w-0 flex-1 truncate text-[12px] leading-[18px] font-medium text-[var(--text-primary)]">
        {file.name}
      </span>
      <span className="shrink-0 text-[10px] leading-[16px] text-[var(--text-tertiary)]">
        {file.size}
      </span>
    </div>
  </div>
);

/**
 * 文件分组（会话标题 + 日期 + 文件卡片行）
 */
const FileGroupSection: React.FC<{
  group: FileGroup;
  onFileClick: (file: LibraryFile) => void;
  onToggleStar: (groupId: string) => void;
}> = ({ group, onFileClick, onToggleStar }) => {
  const [expanded, setExpanded] = useState(false);
  const visibleFiles = expanded ? group.files : group.files.slice(0, 3);
  const overflowCount = group.files.length - 3;

  return (
    <div className="flex flex-col gap-[12px]">
      {/* 分组标题行 */}
      <div className="flex items-center gap-[8px]">
        <span className="text-[var(--text-tertiary)]">
          <FolderIcon size={20} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <span className="truncate text-[14px] leading-[20px] font-medium text-[var(--text-primary)]">
            {group.conversationTitle}
          </span>
          <span className="text-[11px] leading-[16px] text-[var(--text-tertiary)]">
            {group.date}
          </span>
        </div>
        {/* 收藏星标：点击切换，未收藏灰色空心☆，已收藏点亮实心★ */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleStar(group.id); }}
          className="flex shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-[4px] transition-colors hover:opacity-70"
          title={group.starred ? "取消收藏" : "收藏"}
          style={{ color: group.starred ? "#f5a623" : "var(--text-muted)" }}
        >
          {group.starred ? <StarFilledIcon size={16} /> : <StarIcon size={16} />}
        </button>
      </div>

      {/* 文件卡片行（3 列） */}
      <div className="grid grid-cols-3 gap-[12px]">
        {visibleFiles.map((file) => (
          <FileCard key={file.id} file={file} onClick={onFileClick} />
        ))}

        {/* "还有 X 个文件" 占位卡片 */}
        {!expanded && overflowCount > 0 && (
          <div
            onClick={() => setExpanded(true)}
            className="flex cursor-pointer flex-col items-center justify-center gap-[6px] rounded-[12px] border-[0.5px] border-dashed transition-colors hover:bg-[var(--fill-tsp-white-light)]"
            style={{
              height: "196px",
              borderColor: "var(--border-main)",
              backgroundColor: "transparent",
            }}
          >
            <span className="text-[var(--text-tertiary)]">
              <FolderOpenIcon size={28} />
            </span>
            <span className="text-[12px] leading-[18px] font-medium text-[var(--text-secondary)]">
              还有 {overflowCount} 个文件
            </span>
            <span className="text-[11px] leading-[16px] text-[var(--text-tertiary)]">
              点击展开全部
            </span>
          </div>
        )}
      </div>

      {/* 收起按钮 */}
      {expanded && overflowCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex h-[28px] cursor-pointer items-center gap-[4px] self-center rounded-[4px] border-none bg-transparent px-[12px] text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]"
        >
          收起 <ChevronDownIcon size={10} className="rotate-180" />
        </button>
      )}
    </div>
  );
};

/* ================================================================
 *  主组件
 * ================================================================ */

const LibraryPage: React.FC = () => {
  /* ---- 状态 ---- */
  const [activeFilter, setActiveFilter] = useState<"all" | "starred">("all");
  const [typeFilter, setTypeFilter] = useState<FileType | "all">("all");
  /** 搜索输入框的本地值（不触发搜索） */
  const [searchInput, setSearchInput] = useState("");
  /** 实际执行的搜索关键词 */
  const [searchQuery, setSearchQuery] = useState("");

  /* ---- 文件分组数据（含收藏状态） ---- */
  const [fileGroups, setFileGroups] = useState<FileGroup[]>(MOCK_FILE_GROUPS);

  /** 切换收藏 */
  const toggleStar = useCallback((groupId: string) => {
    setFileGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, starred: !g.starred } : g))
    );
  }, []);

  /** 执行搜索 */
  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
  }, [searchInput]);

  /** 清空搜索 */
  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setSearchQuery("");
  }, []);

  /* ---- 筛选 + 搜索 ---- */
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return fileGroups
      .map((group) => {
        // 收藏筛选
        if (activeFilter === "starred" && !group.starred) return null;

        // 文件类型筛选 + 搜索
        const filteredFiles = group.files.filter((file) => {
          if (typeFilter !== "all" && file.type !== typeFilter) return false;
          if (query && !file.name.toLowerCase().includes(query)) return false;
          return true;
        });

        if (filteredFiles.length === 0) return null;

        return { ...group, files: filteredFiles };
      })
      .filter(Boolean) as FileGroup[];
  }, [activeFilter, typeFilter, searchQuery]);

  /* ---- 文件点击 ---- */
  const handleFileClick = useCallback((file: LibraryFile) => {
    alert(`【演示】预览/下载文件：${file.name}（${file.size}）`);
  }, []);

  /* ================================================================
   *  渲染
   * ================================================================ */

  return (
    <div
      className="flex h-full flex-col overflow-hidden"
      style={{ backgroundColor: "var(--bg-main)" }}
    >
      {/* ===== 页面标题区 ===== */}
      <div className="flex shrink-0 items-start justify-between px-[40px] pt-[44px] pb-[12px]">
        <div className="flex flex-col gap-[4px]">
          <h1 className="m-0 text-[24px] leading-[32px] font-semibold text-[var(--text-primary)] tracking-[0.1px]">
            库
          </h1>
          <p className="m-0 text-[13px] leading-[20px] text-[var(--text-secondary)]">
            AI 产出文件集中展示，按会话归集，方便查找和下载
          </p>
        </div>
      </div>

      {/* ===== 筛选栏 ===== */}
      <div className="flex shrink-0 items-center gap-[16px] border-b-[1px] px-[40px] pb-[12px]"
        style={{ borderColor: "var(--border-main)" }}>
        {/* 全部 / 我的收藏（对齐 manus 筛选 tab） */}
        <div className="flex items-center gap-[4px]">
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className={cn(
              "flex h-[32px] cursor-pointer items-center gap-[4px] rounded-[8px] border-none px-[12px] text-[13px] leading-[20px] font-medium transition-colors",
              activeFilter === "all"
                ? "bg-[var(--fill-tsp-white-main)] text-[var(--text-primary)]"
                : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
            )}
          >
            全部
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter("starred")}
            className={cn(
              "flex h-[32px] cursor-pointer items-center gap-[4px] rounded-[8px] border-none px-[12px] text-[13px] leading-[20px] font-medium transition-colors",
              activeFilter === "starred"
                ? "bg-[var(--fill-tsp-white-main)] text-[var(--text-primary)]"
                : "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
            )}
          >
            <StarFilledIcon size={14} /> 我的收藏
          </button>
        </div>

        {/* 弹性空间 */}
        <div className="flex-1" />

        {/* 类型筛选 */}
        <TypeFilter value={typeFilter} onChange={setTypeFilter} />

        {/* 搜索框（按钮触发） */}
        <div className="flex items-center gap-[6px]">
          <div
            className="flex h-[28px] items-center gap-[4px] rounded-[6px] border px-[8px] transition-colors focus-within:border-[var(--color-primary)]"
            style={{
              borderColor: "var(--border-main)",
              backgroundColor: "transparent",
              width: "200px",
            }}
          >
            <span className="flex shrink-0 items-center text-[var(--text-muted)]">
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              placeholder="搜索文件..."
              className="flex-1 border-none bg-transparent text-[13px] leading-[18px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
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
      </div>

      {/* ===== 文件列表（按会话分组，可滚动） ===== */}
      <div className="flex-1 overflow-y-auto px-[40px] py-[24px]">
        {filteredGroups.length > 0 ? (
          <div className="mx-auto flex max-w-[960px] flex-col gap-[32px]">
            {filteredGroups.map((group) => (
              <FileGroupSection
                key={group.id}
                group={group}
                onFileClick={handleFileClick}
                onToggleStar={toggleStar}
              />
            ))}
          </div>
        ) : (
          /* 空状态 */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <span className="text-[var(--text-muted)]">
              <FolderOpenIcon size={56} />
            </span>
            <p className="mt-4 text-[15px] font-medium text-[var(--text-primary)]">
              {activeFilter === "starred" ? "还没有收藏任何文件" : "没有找到匹配的文件"}
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              {activeFilter === "starred"
                ? "在会话中让 AI 生成文件后，可以在这里收藏查看"
                : searchQuery
                  ? `没有找到包含 "${searchQuery}" 的文件`
                  : "试试切换文件类型筛选或搜索其他关键词"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibraryPage;
