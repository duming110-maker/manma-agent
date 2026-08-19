"use client";

/**
 * BC Agent 设置页面 —— 左侧导航 + 右侧内容 + 完整前端交互
 *
 * 变更记录：
 * - 2026-07-07 | 初始化 + 重构左侧导航布局
 * - 2026-07-07 | 升级：完整前端 CRUD、确认弹窗、Toast 通知、内容查看器
 */

import { cn } from "@/lib/utils";
import { BookIcon, BrainIcon, ListIcon, PlusIcon } from "@/components/icons";
import React, { useCallback, useState } from "react";

/* ================================================================
 *  类型
 * ================================================================ */

type SettingsNav = "knowledge" | "rules" | "memory";
type MemorySubTab = "global" | "project";

interface KnowledgeItem { id: string; title: string; summary: string; enabled: boolean; content: string; }
interface RuleItem { id: string; name: string; content: string; }
/** 记忆四类型（对齐架构设计 v0.4） */
type MemoryType = "user" | "feedback" | "project" | "reference";

const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  user: "用户偏好",
  feedback: "行为反馈",
  project: "项目动态",
  reference: "外部参考",
};

const MEMORY_TYPE_COLORS: Record<MemoryType, string> = {
  user: "var(--color-primary)",
  feedback: "#f5a623",
  project: "#4caf50",
  reference: "#2196f3",
};

interface MemoryItem {
  id: string;
  /** 记忆名称（slug） */
  name: string;
  /** 记忆四类型 */
  memoryType: MemoryType;
  /** 一行摘要（MEMORY.md 索引用） */
  description: string;
  /** 记忆正文 */
  content: string;
  /** feedback 类型：为什么这样要求 */
  why?: string;
  /** feedback 类型：如何应用 */
  howToApply?: string;
  /** 归属类别（全局记忆 / 工作事项名称） */
  category: string;
}

/* ================================================================
 *  初始数据
 * ================================================================ */

const INIT_KNOWLEDGE: KnowledgeItem[] = [
  { id: "k1", title: "公司催收政策要点", summary: "逾期催收的标准流程、各阶段话术要求、合规红线", enabled: true, content: "详细内容：\n1. 逾期1-30天：以温馨提醒为主，语气友善\n2. 逾期31-60天：明确告知逾期后果，语气坚定\n3. 逾期61-90天：告知法务介入可能\n4. 严禁威胁、恐吓、骚扰客户" },
  { id: "k2", title: "房抵贷产品大纲", summary: "抵押物准入标准、评估方法、贷款额度计算规则", enabled: true, content: "抵押物准入标准：\n1. 房产类型：住宅、商业\n2. 房龄不超过30年\n3. 评估价值不低于50万元\n4. 贷款额度 = 评估价 × 70%" },
  { id: "k3", title: "OA填写规范", summary: "各类OA表单的填写要求和注意事项汇总", enabled: false, content: "OA表单填写规范：\n1. 请假单需提前一天提交\n2. 报销单需附发票原件\n3. 出差申请需部门负责人审批" },
  { id: "k4", title: "风控准入基本规则", summary: "贷款申请准入的基本门槛、必备材料清单、禁入行业", enabled: true, content: "风控准入规则：\n1. 借款人年龄22-60周岁\n2. 月收入不低于月供的2倍\n3. 禁入行业：博彩、典当、P2P\n4. 需提供6个月银行流水" },
];

const INIT_RULES: RuleItem[] = [
  { id: "r1", name: "正式回复风格", content: "使用专业、简洁的语言。用数据说话，避免主观猜测。结论前置，分析在后。每次回复附上信息来源和免责声明。" },
  { id: "r2", name: "数据分析报告模板", content: "报告需包含：数据摘要 → 趋势分析 → 异常标记 → 建议措施。使用表格和图表辅助说明，关键数据加粗标注。" },
  { id: "r3", name: "客户沟通语气", content: "对客户沟通保持亲切但不失专业的语气。称呼使用'您'，避免行业黑话。在催收场景中，先理解客户情况再提出解决方案。" },
];

const INIT_GLOBAL_MEMORY: MemoryItem[] = [
  {
    id: "m1",
    name: "偏好简洁回复",
    memoryType: "user",
    description: "用户偏好先看结论，再看分析过程，不喜欢冗长描述",
    content: "用户偏好简洁的数据呈现方式，不喜欢冗长的文字描述。在分析报告中倾向于先看到结论再看到过程。对图表和可视化内容接受度高。",
    category: "全局记忆",
  },
  {
    id: "m2",
    name: "不要末尾总结",
    memoryType: "feedback",
    description: "用户明确要求省略回复末尾的总结段落，直接给结果即可",
    content: "用户说「不要在响应末尾总结」，因为他们能自己看结果。Why: 用户觉得总结浪费时间，更喜欢直接给出结果而非先总结再结果。How to apply: 完成任务后直接结束，不要加「总结」或「以上是...」段落。",
    why: "用户觉得总结浪费时间，更喜欢直接给出结果而非先总结再结果",
    howToApply: "完成任务后直接结束，不要加「总结」或「以上是...」段落，也不要重复用户已经知道的信息",
    category: "全局记忆",
  },
  {
    id: "m3",
    name: "催收业务背景",
    memoryType: "user",
    description: "该员工负责催收业务线，主要关注M3+阶段逾期客户",
    content: "该员工负责催收业务线，主要关注M3+阶段的逾期客户。日常工作涉及催收策略制定、客户沟通话术设计、逾期数据分析。",
    category: "全局记忆",
  },
  {
    id: "m4",
    name: "CI仪表盘地址",
    memoryType: "reference",
    description: "公司 CI 持续集成仪表盘入口地址",
    content: "CI 仪表盘地址：https://ci.internal.company.com。用于查看构建状态、测试覆盖率报告和部署日志。",
    category: "全局记忆",
  },
];

const INIT_PROJECT_MEMORY: MemoryItem[] = [
  {
    id: "m5",
    name: "催收话术风格偏好",
    memoryType: "feedback",
    description: "催收场景中偏好分段式话术策略，三段式递进",
    content: "在催收工作事项中，用户倾向于使用分段式话术策略：第一阶段温和提醒、第二阶段明确后果、第三阶段升级警告。偏好使用短句和明确的行动指引。Why: 按逾期严重程度分级沟通更有效。How to apply: 生成催收话术时按M1→M2→M3递进设计三段话术。",
    why: "按逾期严重程度分级沟通更有效，避免对轻度逾期客户过于强硬",
    howToApply: "生成催收话术时按M1→M2→M3递进设计三段话术，每段语气和策略逐步升级",
    category: "催收工作事项",
  },
  {
    id: "m6",
    name: "风控报告格式偏好",
    memoryType: "user",
    description: "风控分析中偏好表格+颜色标记呈现对比数据",
    content: "用户偏好用表格呈现对比数据，风险等级用红黄绿三色标记。每次分析报告都需要包含风险等级分布饼图和趋势折线图。",
    category: "风控分析",
  },
];

/* ================================================================
 *  通用子组件
 * ================================================================ */

/** 左侧导航项 */
const NavItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void; }> =
  ({ icon, label, active, onClick }) => (
    <div onClick={onClick} className={cn(
      "flex h-[36px] w-full cursor-pointer items-center gap-[10px] rounded-[10px] px-[12px]",
      "text-[14px] leading-[21px] transition-colors select-none",
      active ? "bg-[var(--fill-tsp-white-light)] text-[var(--text-primary)] font-medium" : "text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]"
    )}>
      <span className="flex size-[18px] items-center justify-center">{icon}</span>
      <span>{label}</span>
    </div>
  );

/** Toggle 开关 */
const Toggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button type="button" onClick={onChange}
    className="relative flex h-[22px] w-[40px] shrink-0 cursor-pointer items-center rounded-full border-none transition-colors"
    style={{ backgroundColor: on ? "var(--color-primary)" : "rgba(0,0,0,0.15)" }}>
    <span className={cn("size-[16px] rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[20px]" : "translate-x-[2px]")} />
  </button>
);

/** Toast 通知条 */
const Toast: React.FC<{ message: string; visible: boolean; }> = ({ message, visible }) => (
  <div className={cn(
    "fixed bottom-[40px] left-1/2 z-[70] -translate-x-1/2 rounded-[10px] px-[20px] py-[10px] text-[13px] font-medium text-white shadow-lg transition-all duration-300",
    visible ? "translate-y-0 opacity-100" : "translate-y-[20px] opacity-0 pointer-events-none"
  )} style={{ backgroundColor: "#1d1d1f" }}>
    {message}
  </div>
);

/** 确认弹窗 */
const ConfirmDialog: React.FC<{
  open: boolean; title: string; message: string; confirmLabel?: string;
  onConfirm: () => void; onCancel: () => void;
}> = ({ open, title, message, confirmLabel = "确定", onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div className="mx-4 w-full max-w-[360px] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-main)" }} onClick={e => e.stopPropagation()}>
        <div className="p-[24px] text-center">
          <h4 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">{title}</h4>
          <p className="m-0 mt-[8px] text-[13px] leading-[20px] text-[var(--text-secondary)]">{message}</p>
        </div>
        <div className="flex border-t-[0.5px]" style={{ borderColor: "var(--border-main)" }}>
          <button onClick={onCancel}
            className="flex-1 h-[44px] cursor-pointer border-none bg-transparent text-[14px] text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)]">
            取消
          </button>
          <div className="w-[0.5px] self-stretch" style={{ backgroundColor: "var(--border-main)" }} />
          <button onClick={onConfirm}
            className="flex-1 h-[44px] cursor-pointer border-none bg-transparent text-[14px] font-medium text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_6%,transparent)]">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/** 表单弹窗 */
const FormModal: React.FC<{
  open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode;
}> = ({ open, onClose, title, children, footer }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <div className="mx-4 max-h-[85vh] w-full max-w-[520px] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-main)" }} onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b-[0.5px] px-[24px] py-[18px]" style={{ borderColor: "var(--border-main)" }}>
          <h3 className="m-0 text-[16px] font-semibold text-[var(--text-primary)]">{title}</h3>
          <button onClick={onClose} className="flex size-[28px] cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-light)]">✕</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-[24px]">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-[8px] border-t-[0.5px] px-[24px] py-[16px]" style={{ borderColor: "var(--border-main)" }}>{footer}</div>}
      </div>
    </div>
  );
};

/** 内容查看弹窗 */
const ContentModal: React.FC<{ open: boolean; onClose: () => void; title: string; content: string; }> =
  ({ open, onClose, title, content }) => {
    if (!open) return null;
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }} onClick={onClose}>
        <div className="mx-4 max-h-[80vh] w-full max-w-[560px] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border-main)" }} onClick={e => e.stopPropagation()}>
          <div className="flex shrink-0 items-center justify-between border-b-[0.5px] px-[24px] py-[18px]" style={{ borderColor: "var(--border-main)" }}>
            <h3 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">{title}</h3>
            <button onClick={onClose} className="flex size-[28px] cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-light)]">✕</button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-[24px]">
            <p className="m-0 whitespace-pre-wrap text-[14px] leading-[24px] text-[var(--text-primary)]">{content}</p>
          </div>
        </div>
      </div>
    );
  };

/* ================================================================
 *  主组件
 * ================================================================ */

interface SettingsPageProps { onClose: () => void; }

const SettingsPage: React.FC<SettingsPageProps> = ({ onClose }) => {
  const [nav, setNav] = useState<SettingsNav>("knowledge");
  const [memSub, setMemSub] = useState<MemorySubTab>("global");

  /* ---- 数据状态 ---- */
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeItem[]>(INIT_KNOWLEDGE);
  const [ruleList, setRuleList] = useState<RuleItem[]>(INIT_RULES);
  const [globalMemory, setGlobalMemory] = useState<MemoryItem[]>(INIT_GLOBAL_MEMORY);
  const [projectMemory, setProjectMemory] = useState<MemoryItem[]>(INIT_PROJECT_MEMORY);

  /* ---- 弹窗状态 ---- */
  const [modalType, setModalType] = useState<"knowledge" | "rule" | "memory" | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [kForm, setKForm] = useState({ title: "", summary: "", content: "", enabled: true });
  const [rForm, setRForm] = useState({ name: "", content: "" });
  const [mForm, setMForm] = useState({
    name: "",
    memoryType: "user" as MemoryType,
    category: "",
    content: "",
    why: "",
    howToApply: "",
  });

  /* 确认弹窗 */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<() => void>(() => {});
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMsg, setConfirmMsg] = useState("");

  /* 内容查看 */
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerContent, setViewerContent] = useState("");

  /* Toast */
  const [toast, setToast] = useState({ message: "", visible: false });

  /* ---- Toast 辅助 ---- */
  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2200);
  }, []);

  /* ---- 确认弹窗辅助 ---- */
  const requestConfirm = useCallback((title: string, msg: string, action: () => void) => {
    setConfirmTitle(title); setConfirmMsg(msg); setConfirmAction(() => action); setConfirmOpen(true);
  }, []);

  /* ---- 知识库操作 ---- */
  const openKModal = useCallback((item?: KnowledgeItem) => {
    setKForm(item ? { title: item.title, summary: item.summary, content: item.content, enabled: item.enabled }
      : { title: "", summary: "", content: "", enabled: true });
    setEditingId(item?.id ?? null); setModalType("knowledge");
  }, []);

  const saveKnowledge = useCallback(() => {
    if (!kForm.title.trim()) return;
    setKnowledgeList(prev => {
      if (editingId) return prev.map(k => k.id === editingId ? { ...k, ...kForm } : k);
      return [{ id: `k-${Date.now()}`, ...kForm }, ...prev];
    });
    setModalType(null);
    showToast(editingId ? "知识条目已更新" : "知识条目已创建");
  }, [kForm, editingId, showToast]);

  const toggleKnowledge = useCallback((id: string) => {
    setKnowledgeList(prev => prev.map(k => k.id === id ? { ...k, enabled: !k.enabled } : k));
    const item = knowledgeList.find(k => k.id === id);
    if (item) showToast(item.enabled ? "已停用" : "已启用");
  }, [knowledgeList, showToast]);

  const deleteKnowledge = useCallback((id: string) => {
    const item = knowledgeList.find(k => k.id === id);
    requestConfirm("删除知识条目", `确定要删除「${item?.title}」吗？删除后不可恢复。`, () => {
      setKnowledgeList(prev => prev.filter(k => k.id !== id));
      showToast("知识条目已删除");
    });
  }, [knowledgeList, requestConfirm, showToast]);

  /* ---- 规则操作 ---- */
  const openRModal = useCallback((item?: RuleItem) => {
    setRForm(item ? { name: item.name, content: item.content } : { name: "", content: "" });
    setEditingId(item?.id ?? null); setModalType("rule");
  }, []);

  const saveRule = useCallback(() => {
    if (!rForm.name.trim()) return;
    setRuleList(prev => {
      if (editingId) return prev.map(r => r.id === editingId ? { ...r, ...rForm } : r);
      return [{ id: `r-${Date.now()}`, ...rForm }, ...prev];
    });
    setModalType(null);
    showToast(editingId ? "规则已更新" : "规则已创建");
  }, [rForm, editingId, showToast]);

  const deleteRule = useCallback((id: string) => {
    const item = ruleList.find(r => r.id === id);
    requestConfirm("删除规则", `确定要删除规则「${item?.name}」吗？`, () => {
      setRuleList(prev => prev.filter(r => r.id !== id));
      showToast("规则已删除");
    });
  }, [ruleList, requestConfirm, showToast]);

  /* ---- 记忆操作 ---- */
  const memoryList = memSub === "global" ? globalMemory : projectMemory;
  const setMemoryList = memSub === "global" ? setGlobalMemory : setProjectMemory;

  const openMModal = useCallback((item?: MemoryItem) => {
    setMForm(item ? {
      name: item.name,
      memoryType: item.memoryType,
      category: item.category,
      content: item.content,
      why: item.why || "",
      howToApply: item.howToApply || "",
    } : {
      name: "",
      memoryType: "user" as MemoryType,
      category: memSub === "global" ? "全局记忆" : "",
      content: "",
      why: "",
      howToApply: "",
    });
    setEditingId(item?.id ?? null); setModalType("memory");
  }, [memSub]);

  const saveMemory = useCallback(() => {
    if (!mForm.content.trim() || !mForm.name.trim()) return;
    setMemoryList(prev => {
      if (editingId) return prev.map(m => m.id === editingId ? {
        ...m,
        name: mForm.name,
        memoryType: mForm.memoryType,
        category: mForm.category || "全局记忆",
        content: mForm.content,
        description: mForm.content.length > 50 ? mForm.content.substring(0, 50) + "..." : mForm.content,
        why: mForm.why,
        howToApply: mForm.howToApply,
      } : m);
      return [{
        id: `m-${Date.now()}`,
        name: mForm.name,
        memoryType: mForm.memoryType,
        description: mForm.content.length > 50 ? mForm.content.substring(0, 50) + "..." : mForm.content,
        content: mForm.content,
        why: mForm.why,
        howToApply: mForm.howToApply,
        category: mForm.category || "全局记忆",
      }, ...prev];
    });
    setModalType(null);
    showToast(editingId ? "记忆已更新" : "记忆已创建");
  }, [mForm, editingId, showToast, setMemoryList]);

  const viewMemory = useCallback((item: MemoryItem) => {
    setViewerTitle(`${item.name}（${MEMORY_TYPE_LABELS[item.memoryType]}）`);
    let fullContent = item.content;
    if (item.why) fullContent += `\n\n---\nWhy（为什么这样要求）：\n${item.why}`;
    if (item.howToApply) fullContent += `\n\nHow to apply（如何应用）：\n${item.howToApply}`;
    setViewerContent(fullContent);
    setViewerOpen(true);
  }, []);

  const deleteMemory = useCallback((id: string) => {
    const item = memoryList.find(m => m.id === id);
    requestConfirm("删除记忆", `确定要删除「${item?.category}」中的这条记忆吗？`, () => {
      setMemoryList(prev => prev.filter(m => m.id !== id));
      showToast("记忆已删除");
    });
  }, [memoryList, requestConfirm, showToast, setMemoryList]);

  /* 表单通用样式 */
  const inputS: React.CSSProperties = { backgroundColor: "var(--bg-main)", borderColor: "var(--border-main)" };

  /* ================================================================
   *  渲染
   * ================================================================ */
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.4)" }}>
      <div className="flex h-[85vh] w-[75%] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg"
        style={{ backgroundColor: "var(--bg-main)", borderColor: "var(--border-main)" }}>

        {/* ===== 左侧导航（220px） ===== */}
        <div className="flex w-[220px] shrink-0 flex-col border-r-[0.5px]" style={{ borderColor: "var(--border-main)" }}>
          <div className="flex items-center gap-[10px] px-[20px] py-[20px]">
            <button onClick={onClose}
              className="flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-[8px] border-none bg-transparent text-[var(--text-secondary)] hover:bg-[var(--fill-tsp-white-light)] text-[16px]">
              ←
            </button>
            <h2 className="m-0 text-[17px] font-semibold text-[var(--text-primary)]">设置</h2>
          </div>
          <div className="flex flex-1 flex-col gap-[2px] px-[12px] py-[8px]">
            <NavItem icon={<BookIcon size={16} />} label="知识库" active={nav === "knowledge"} onClick={() => setNav("knowledge")} />
            <NavItem icon={<ListIcon size={16} />} label="规则管理" active={nav === "rules"} onClick={() => setNav("rules")} />
            <NavItem icon={<BrainIcon size={16} />} label="记忆管理" active={nav === "memory"} onClick={() => setNav("memory")} />
          </div>
        </div>

        {/* ===== 右侧内容区 ===== */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* ---------- 知识库 ---------- */}
          {nav === "knowledge" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between px-[32px] py-[20px]">
                <div>
                  <h3 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">知识库</h3>
                  <p className="m-0 mt-[4px] text-[12px] text-[var(--text-tertiary)]">维护业务知识，AI 在对话中自动参考。共 {knowledgeList.length} 条</p>
                </div>
                <button onClick={() => openKModal()}
                  className="flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] border-none px-[12px] text-[13px] font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)" }}>
                  <PlusIcon size={14} /> 新建知识
                </button>
              </div>
              <div className="flex-1 overflow-auto px-[32px] pb-[24px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-[0.5px] text-left" style={{ borderColor: "var(--border-main)" }}>
                      <th className="w-[28%] py-[10px] pr-[16px] text-[12px] font-medium text-[var(--text-tertiary)]">标题</th>
                      <th className="w-[38%] py-[10px] pr-[16px] text-[12px] font-medium text-[var(--text-tertiary)]">摘要</th>
                      <th className="w-[10%] py-[10px] pr-[16px] text-[12px] font-medium text-[var(--text-tertiary)]">启用</th>
                      <th className="w-[24%] py-[10px] text-[12px] font-medium text-[var(--text-tertiary)]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {knowledgeList.map(item => {
                      /** 标题截断：超过12字用省略号，hover展示全文 */
                      const titleTruncated = item.title.length > 12
                        ? item.title.substring(0, 12) + "..."
                        : item.title;
                      /** 摘要截断：超过25字用省略号，hover展示全文 */
                      const summaryTruncated = item.summary.length > 25
                        ? item.summary.substring(0, 25) + "..."
                        : item.summary;
                      return (
                      <tr key={item.id} className="border-b-[0.5px] transition-colors hover:bg-[var(--fill-tsp-white-light)]" style={{ borderColor: "var(--border-main)" }}>
                        <td className="py-[10px] pr-[16px] text-[13px] font-medium text-[var(--text-primary)]"
                          title={item.title.length > 12 ? item.title : undefined}>
                          {titleTruncated}
                        </td>
                        <td className="py-[10px] pr-[16px] text-[12px] leading-[18px] text-[var(--text-secondary)]"
                          title={item.summary.length > 25 ? item.summary : undefined}>
                          {summaryTruncated}
                        </td>
                        <td className="py-[10px] pr-[16px]"><Toggle on={item.enabled} onChange={() => toggleKnowledge(item.id)} /></td>
                        <td className="py-[10px]">
                          <div className="flex items-center gap-[6px]">
                            <button onClick={() => openKModal(item)} className="btn-action-edit">编辑</button>
                            <button onClick={() => deleteKnowledge(item.id)} className="btn-action-delete">删除</button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                {knowledgeList.length === 0 && <div className="py-16 text-center text-[13px] text-[var(--text-muted)]">暂无知识条目，点击「新建知识」添加</div>}
              </div>
            </div>
          )}

          {/* ---------- 规则管理 ---------- */}
          {nav === "rules" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between px-[32px] py-[20px]">
                <div>
                  <h3 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">规则管理</h3>
                  <p className="m-0 mt-[4px] text-[12px] text-[var(--text-tertiary)]">
                    自定义 AI 的行为规则与回复风格，主要适用于自由会话（工作事项已有专属规则定义）。共 {ruleList.length} 条
                  </p>
                </div>
                <button onClick={() => openRModal()}
                  className="flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] border-none px-[12px] text-[13px] font-medium text-white hover:opacity-90"
                  style={{ backgroundColor: "var(--color-primary)" }}>
                  <PlusIcon size={14} /> 新建规则
                </button>
              </div>
              <div className="flex-1 overflow-auto px-[32px] pb-[24px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-[0.5px] text-left" style={{ borderColor: "var(--border-main)" }}>
                      <th className="w-[25%] py-[10px] pr-[16px] text-[12px] font-medium text-[var(--text-tertiary)]">规则名称</th>
                      <th className="w-[50%] py-[10px] pr-[16px] text-[12px] font-medium text-[var(--text-tertiary)]">规则内容（摘要）</th>
                      <th className="w-[25%] py-[10px] text-[12px] font-medium text-[var(--text-tertiary)]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ruleList.map(item => (
                      <tr key={item.id} className="border-b-[0.5px] transition-colors hover:bg-[var(--fill-tsp-white-light)]" style={{ borderColor: "var(--border-main)" }}>
                        <td className="py-[10px] pr-[16px] text-[13px] font-medium text-[var(--text-primary)]">{item.name}</td>
                        <td className="py-[10px] pr-[16px] text-[12px] leading-[18px] text-[var(--text-secondary)]"><span className="line-clamp-2">{item.content}</span></td>
                        <td className="py-[10px]">
                          <div className="flex items-center gap-[6px]">
                            <button onClick={() => openRModal(item)} className="btn-action-edit">编辑</button>
                            <button onClick={() => deleteRule(item.id)} className="btn-action-delete">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {ruleList.length === 0 && <div className="py-16 text-center text-[13px] text-[var(--text-muted)]">暂无规则，点击「新建规则」添加</div>}
              </div>
            </div>
          )}

          {/* ---------- 记忆管理 ---------- */}
          {nav === "memory" && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-between px-[32px] py-[20px]">
                <div>
                  <h3 className="m-0 text-[15px] font-semibold text-[var(--text-primary)]">记忆管理</h3>
                  <p className="m-0 mt-[4px] text-[12px] text-[var(--text-tertiary)]">
                    四类型记忆（用户偏好 / 行为反馈 / 项目动态 / 外部参考），AI 在对话中自动积累和召回。共 {memoryList.length} 条
                  </p>
                </div>
                <div className="flex items-center gap-[12px]">
                  <div className="flex items-center gap-[4px] rounded-[8px] p-[3px]" style={{ backgroundColor: "var(--fill-tsp-white-light)" }}>
                    {(["global", "project"] as MemorySubTab[]).map(sub => (
                      <button key={sub} onClick={() => setMemSub(sub)}
                        className={cn("flex h-[28px] cursor-pointer items-center rounded-[6px] border-none px-[12px] text-[12px] font-medium transition-colors",
                          memSub === sub ? "bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm" : "bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
                        {sub === "global" ? "全局记忆" : "工作事项记忆"}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => openMModal()}
                    className="flex h-[32px] cursor-pointer items-center gap-[6px] rounded-[8px] border-none px-[12px] text-[13px] font-medium text-white hover:opacity-90"
                    style={{ backgroundColor: "var(--color-primary)" }}>
                    <PlusIcon size={14} /> 新增记忆
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto px-[32px] pb-[24px]">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-[0.5px] text-left" style={{ borderColor: "var(--border-main)" }}>
                      <th className="w-[10%] py-[10px] pr-[12px] text-[12px] font-medium text-[var(--text-tertiary)]">类型</th>
                      <th className="w-[16%] py-[10px] pr-[12px] text-[12px] font-medium text-[var(--text-tertiary)]">记忆名称</th>
                      <th className="w-[30%] py-[10px] pr-[12px] text-[12px] font-medium text-[var(--text-tertiary)]">记忆摘要</th>
                      <th className="w-[16%] py-[10px] pr-[12px] text-[12px] font-medium text-[var(--text-tertiary)]">{memSub === "global" ? "类别" : "工作事项"}</th>
                      <th className="w-[28%] py-[10px] text-[12px] font-medium text-[var(--text-tertiary)]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memoryList.map(item => (
                      <tr key={item.id} className="border-b-[0.5px] transition-colors hover:bg-[var(--fill-tsp-white-light)]" style={{ borderColor: "var(--border-main)" }}>
                        {/* 记忆类型标签 */}
                        <td className="py-[10px] pr-[12px]">
                          <span
                            className="inline-block rounded-[4px] px-[6px] py-[1px] text-[11px] leading-[16px] font-medium whitespace-nowrap"
                            style={{
                              backgroundColor: "color-mix(in srgb, " + MEMORY_TYPE_COLORS[item.memoryType] + " 10%, transparent)",
                              color: MEMORY_TYPE_COLORS[item.memoryType],
                            }}
                          >
                            {MEMORY_TYPE_LABELS[item.memoryType]}
                          </span>
                        </td>
                        {/* 记忆名称（截断12字） */}
                        <td className="py-[10px] pr-[12px] text-[13px] font-medium text-[var(--text-primary)]"
                          title={item.name.length > 12 ? item.name : undefined}>
                          {item.name.length > 12 ? item.name.substring(0, 12) + "..." : item.name}
                        </td>
                        {/* 记忆摘要（截断25字） */}
                        <td className="py-[10px] pr-[12px] text-[12px] leading-[18px] text-[var(--text-secondary)]"
                          title={item.description.length > 25 ? item.description : undefined}>
                          {item.description.length > 25 ? item.description.substring(0, 25) + "..." : item.description}
                        </td>
                        {/* 类别 / 工作事项 */}
                        <td className="py-[10px] pr-[12px] text-[13px] text-[var(--text-primary)]">{item.category}</td>
                        <td className="py-[10px]">
                          <div className="flex items-center gap-[6px]">
                            <button onClick={() => viewMemory(item)} className="btn-action-edit">查看</button>
                            <button onClick={() => openMModal(item)} className="btn-action-edit">编辑</button>
                            <button onClick={() => deleteMemory(item.id)} className="btn-action-delete">删除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {memoryList.length === 0 && <div className="py-16 text-center text-[13px] text-[var(--text-muted)]">暂无记忆，点击「新增记忆」添加</div>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== 知识库弹窗 ===== */}
      <FormModal open={modalType === "knowledge"} onClose={() => setModalType(null)}
        title={editingId ? "编辑知识" : "新建知识"}
        footer={<>
          <button onClick={() => setModalType(null)} className="btn-cancel">取消</button>
          <button onClick={saveKnowledge} disabled={!kForm.title.trim()} className="btn-primary" style={{ backgroundColor: "var(--color-primary)", opacity: kForm.title.trim() ? 1 : 0.4 }}>保存</button>
        </>}>
        <div className="flex flex-col gap-[16px]">
          <label className="flex flex-col gap-[6px]"><span className="text-[13px] font-medium text-[var(--text-primary)]">标题 <span className="text-[var(--color-error)]">*</span></span>
            <input type="text" value={kForm.title} onChange={e => setKForm({ ...kForm, title: e.target.value })} placeholder="知识条目名称" className="input-s" style={inputS} /></label>
          <label className="flex flex-col gap-[6px]"><span className="text-[13px] font-medium text-[var(--text-primary)]">摘要</span>
            <input type="text" value={kForm.summary} onChange={e => setKForm({ ...kForm, summary: e.target.value })} placeholder="AI 用于判断是否引用该知识" className="input-s" style={inputS} /></label>
          <label className="flex items-center gap-[10px] cursor-pointer"><input type="checkbox" checked={kForm.enabled} onChange={e => setKForm({ ...kForm, enabled: e.target.checked })} className="size-[16px] accent-[var(--color-primary)]" /><span className="text-[13px] text-[var(--text-secondary)]">启用（AI 在对话中参考该知识）</span></label>
          <label className="flex flex-col gap-[6px]">
            <span className="text-[13px] font-medium text-[var(--text-primary)]">内容 <span className="text-[var(--color-error)]">*</span></span>
            <textarea value={kForm.content} onChange={e => setKForm({ ...kForm, content: e.target.value })} placeholder="支持手动输入，也可上传 PDF、Word、Markdown 等文件" rows={5} className="input-s min-h-[120px] resize-y" style={inputS} />
            <div className="mt-[2px] flex items-center gap-[8px]">
              <label className="flex h-[28px] cursor-pointer items-center gap-[6px] rounded-[6px] border-[0.5px] px-[10px] text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--fill-tsp-white-light)]" style={{ borderColor: "var(--border-main)" }}>
                📎 上传文件
                <input type="file" accept=".md,.txt,.pdf,.doc,.docx" style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const ext = f.name.split(".").pop()?.toLowerCase();
                    // 客户端解析文本类（.md/.txt）；二进制（PDF/Word）给占位标记，后端解析
                    if (ext === "md" || ext === "txt") {
                      const reader = new FileReader();
                      reader.onload = () => setKForm({ ...kForm, content: (reader.result as string) || "" });
                      reader.readAsText(f);
                    } else {
                      setKForm({ ...kForm, content: `[已上传: ${f.name}，待后端解析]` });
                    }
                    e.target.value = "";
                  }} />
              </label>
              <span className="text-[11px] text-[var(--text-muted)]">.md / .txt 将自动填入内容；PDF / Word 上传后由后端解析</span>
            </div>
          </label>
        </div>
      </FormModal>

      {/* ===== 规则弹窗 ===== */}
      <FormModal open={modalType === "rule"} onClose={() => setModalType(null)}
        title={editingId ? "编辑规则" : "新建规则"}
        footer={<>
          <button onClick={() => setModalType(null)} className="btn-cancel">取消</button>
          <button onClick={saveRule} disabled={!rForm.name.trim()} className="btn-primary" style={{ backgroundColor: "var(--color-primary)", opacity: rForm.name.trim() ? 1 : 0.4 }}>保存</button>
        </>}>
        <div className="flex flex-col gap-[16px]">
          <label className="flex flex-col gap-[6px]"><span className="text-[13px] font-medium text-[var(--text-primary)]">规则名称 <span className="text-[var(--color-error)]">*</span></span>
            <input type="text" value={rForm.name} onChange={e => setRForm({ ...rForm, name: e.target.value })} placeholder="用于识别规则" className="input-s" style={inputS} /></label>
          <label className="flex flex-col gap-[6px]"><span className="text-[13px] font-medium text-[var(--text-primary)]">规则内容 <span className="text-[var(--color-error)]">*</span></span>
            <span className="text-[11px] text-[var(--text-muted)]">例如：风格要求、人设、回复语气等</span>
            <textarea value={rForm.content} onChange={e => setRForm({ ...rForm, content: e.target.value })} placeholder="输入对 AI 的风格要求、行为规范..." rows={5} className="input-s min-h-[120px] resize-y" style={inputS} /></label>
        </div>
      </FormModal>

      {/* ===== 记忆弹窗 ===== */}
      <FormModal open={modalType === "memory"} onClose={() => setModalType(null)}
        title={editingId ? "编辑记忆" : "新增记忆"}
        footer={<>
          <button onClick={() => setModalType(null)} className="btn-cancel">取消</button>
          <button onClick={saveMemory}
            disabled={!mForm.content.trim() || !mForm.name.trim()}
            className="btn-primary"
            style={{ backgroundColor: "var(--color-primary)", opacity: (mForm.content.trim() && mForm.name.trim()) ? 1 : 0.4 }}>
            保存
          </button>
        </>}>
        <div className="flex flex-col gap-[16px]">
          {/* 记忆名称 */}
          <label className="flex flex-col gap-[6px]">
            <span className="text-[13px] font-medium text-[var(--text-primary)]">记忆名称 <span className="text-[var(--color-error)]">*</span></span>
            <input type="text" value={mForm.name} onChange={e => setMForm({ ...mForm, name: e.target.value })}
              placeholder="简短标识，如：偏好简洁回复"
              className="input-s" style={inputS} />
          </label>

          {/* 记忆类型 */}
          <div className="flex flex-col gap-[6px]">
            <span className="text-[13px] font-medium text-[var(--text-primary)]">记忆类型</span>
            <div className="flex flex-wrap gap-[6px]">
              {(Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMForm({ ...mForm, memoryType: t })}
                  className="flex h-[28px] cursor-pointer items-center rounded-[6px] border-[0.5px] px-[10px] text-[12px] font-medium transition-colors"
                  style={{
                    backgroundColor: mForm.memoryType === t
                      ? "color-mix(in srgb, " + MEMORY_TYPE_COLORS[t] + " 12%, transparent)"
                      : "var(--bg-main)",
                    borderColor: mForm.memoryType === t
                      ? MEMORY_TYPE_COLORS[t]
                      : "var(--border-main)",
                    color: mForm.memoryType === t
                      ? MEMORY_TYPE_COLORS[t]
                      : "var(--text-secondary)",
                  }}
                >
                  {MEMORY_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[var(--text-muted)]">
              {mForm.memoryType === "user" && "用户身份、角色、偏好、知识背景"}
              {mForm.memoryType === "feedback" && "对 AI 行为的纠正或肯定——需填写下方 Why 和 How to apply"}
              {mForm.memoryType === "project" && "项目进展、决策、截止日期——相对日期请转为绝对日期"}
              {mForm.memoryType === "reference" && "外部系统 URL、配置位置、接口文档等"}
            </span>
          </div>

          {/* 类别 */}
          <label className="flex flex-col gap-[6px]">
            <span className="text-[13px] font-medium text-[var(--text-primary)]">{memSub === "global" ? "类别" : "工作事项"}</span>
            <input type="text" value={mForm.category} onChange={e => setMForm({ ...mForm, category: e.target.value })}
              placeholder={memSub === "global" ? "如：全局记忆" : "如：催收工作事项"}
              className="input-s" style={inputS} />
          </label>

          {/* 记忆内容 */}
          <label className="flex flex-col gap-[6px]">
            <span className="text-[13px] font-medium text-[var(--text-primary)]">记忆内容 <span className="text-[var(--color-error)]">*</span></span>
            <span className="text-[11px] text-[var(--text-muted)]">AI 会根据记忆内容自动调整对话风格和工作方式。记忆新鲜度超过 1 天会自动附带过期提醒</span>
            <textarea value={mForm.content} onChange={e => setMForm({ ...mForm, content: e.target.value })}
              placeholder="描述用户的工作偏好、习惯、常用工具等..."
              rows={5} className="input-s min-h-[120px] resize-y" style={inputS} />
          </label>

          {/* feedback 类型专属：Why + How to apply */}
          {mForm.memoryType === "feedback" && (
            <>
              <label className="flex flex-col gap-[6px]">
                <span className="text-[13px] font-medium text-[var(--text-primary)]">Why（为什么这样要求）<span className="text-[var(--color-error)]">*</span></span>
                <span className="text-[11px] text-[var(--text-muted)]">说明用户为什么提出这个反馈，帮助 AI 理解背后的原因</span>
                <textarea value={mForm.why} onChange={e => setMForm({ ...mForm, why: e.target.value })}
                  placeholder="如：用户觉得总结浪费时间，更喜欢直接给出结果..."
                  rows={2} className="input-s min-h-[60px] resize-y" style={inputS} />
              </label>
              <label className="flex flex-col gap-[6px]">
                <span className="text-[13px] font-medium text-[var(--text-primary)]">How to apply（如何应用）<span className="text-[var(--color-error)]">*</span></span>
                <span className="text-[11px] text-[var(--text-muted)]">明确告诉 AI 今后遇到类似情况时应该怎么做</span>
                <textarea value={mForm.howToApply} onChange={e => setMForm({ ...mForm, howToApply: e.target.value })}
                  placeholder="如：完成任务后直接结束，不要加总结段落..."
                  rows={2} className="input-s min-h-[60px] resize-y" style={inputS} />
              </label>
            </>
          )}
        </div>
      </FormModal>

      {/* ===== 内容查看弹窗 ===== */}
      <ContentModal open={viewerOpen} onClose={() => setViewerOpen(false)} title={viewerTitle} content={viewerContent} />

      {/* ===== 确认弹窗 ===== */}
      <ConfirmDialog open={confirmOpen} title={confirmTitle} message={confirmMsg}
        onConfirm={() => { confirmAction(); setConfirmOpen(false); }} onCancel={() => setConfirmOpen(false)} />

      {/* ===== Toast ===== */}
      <Toast message={toast.message} visible={toast.visible} />

      {/* 以下按钮/输入框样式已迁移至 src/globals.css（原 <style jsx>，去 Next.js 依赖） */}
    </div>
  );
};

export default SettingsPage;
