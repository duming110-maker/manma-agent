"use client";

/**
 * 上传技能弹窗，用于向平台导入自定义技能包
 *
 * 变更记录：
 * - 2026-07-10 | 新建。
 * - 2026-07-16 | 新增：技能类型选择（企业级/外部市场）。
 * - 2026-07-16 | 新增：使用范围选择器（全部人员/指定部门+人员），类似模型配置。
 * - 2026-07-16 | 优化：使用范围选择器升级为下拉+搜索多选组件，替代原有 checkbox 列表。
 *
 * 设计规格：
 * - 弹窗宽度 520px，标题"上传技能" + 右上角 ✕ 关闭。
 * - 中部虚线边框文件上传区：点击选文件 + 拖拽上传。
 * - 选中文件后展开：技能类型选择 + 使用范围选择。
 * - 格式规则说明文字。
 * - 底部"取消""确认"按钮，未选有效文件时"确认"置灰禁用。
 */
import { FileIcon, UploadIcon } from "@/components/icons";
import SearchableMultiSelect from "@/components/SearchableMultiSelect";
import type { SelectOption } from "@/components/SearchableMultiSelect";
import { departments, employees } from "@/mock/org";
import React, { useCallback, useRef, useState } from "react";

/** 技能类型：企业级 / 外部市场 */
export type SkillUploadType = 'enterprise' | 'marketplace';

/** 使用范围类型 */
type ScopeType = 'all' | 'specified';

interface UploadSkillModalProps {
  /** 弹窗开启 */
  open: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 上传确认回调（文件名、文件对象、技能类型、使用范围） */
  onConfirm?: (
    fileName: string,
    file: File,
    skillType: SkillUploadType,
    /** 使用范围 */
    scope: { type: ScopeType; departmentIds: number[]; employeeIds: number[] },
  ) => void;
  /** 默认技能类型（跟随当前 tab 联动，不传则默认企业级） */
  defaultSkillType?: SkillUploadType;
  /** 驳回原因（驳回后重新上传时显示，提醒用户修改方向） */
  rejectionReason?: string;
}

const UploadSkillModal: React.FC<UploadSkillModalProps> = ({
  open,
  onClose,
  onConfirm,
  defaultSkillType = 'enterprise',
  rejectionReason,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [skillType, setSkillType] = useState<SkillUploadType>(defaultSkillType);

  /** 当弹窗打开或 defaultSkillType 变化时，同步技能类型到当前 tab */
  React.useEffect(() => {
    if (open) {
      setSkillType(defaultSkillType);
    }
  }, [open, defaultSkillType]);
  /** 使用范围：全部人员 / 指定人员 */
  const [scopeType, setScopeType] = useState<ScopeType>('all');
  /** 指定部门 ID 列表 */
  const [deptIds, setDeptIds] = useState<number[]>([]);
  /** 指定人员 ID 列表 */
  const [empIds, setEmpIds] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 重置所有状态 */
  const resetState = useCallback(() => {
    setFile(null);
    setSkillType(defaultSkillType); // 跟随当前 tab 联动，而非固定企业级
    setScopeType('all');
    setDeptIds([]);
    setEmpIds([]);
  }, [defaultSkillType]);

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

  // 文件选择 / 拖放处理
  const handleFile = useCallback((f: File | null) => {
    if (!f) return;
    setFile(f);
  }, []);

  const handleClick = () => inputRef.current?.click();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] ?? null);
    e.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files?.[0] ?? null);
  };

  /** 提交确认 */
  const handleConfirm = () => {
    if (!file || !onConfirm) return;
    onConfirm(file.name, file, skillType, {
      type: scopeType,
      departmentIds: scopeType === 'specified' ? deptIds : [],
      employeeIds: scopeType === 'specified' ? empIds : [],
    });
    resetState();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div
        className="mx-4 w-[520px] max-h-[90vh] overflow-hidden rounded-[16px] border-[0.5px] shadow-lg flex flex-col"
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
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {rejectionReason ? '重新上传技能' : '上传技能'}
          </h3>
          <button
            onClick={() => { resetState(); onClose(); }}
            className="flex size-[28px] cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-[var(--text-muted)] hover:bg-[var(--fill-tsp-white-light)]"
          >
            ✕
          </button>
        </div>

        {/* 内容区（可滚动） */}
        <div className="flex-1 overflow-y-auto p-[24px]">
          {/* 驳回原因提示（驳回后重新上传时显示） */}
          {rejectionReason && (
            <div
              className="mb-[14px] rounded-[8px] border px-[12px] py-[10px] text-[12px] leading-[18px]"
              style={{
                backgroundColor: 'rgba(255,77,79,0.06)',
                borderColor: 'rgba(255,77,79,0.2)',
                color: '#cf1322',
              }}
            >
              <b>⚠ 驳回原因：</b>{rejectionReason}
              <div className="mt-[6px] text-[11px] opacity-80">
                请根据以上意见修改技能文件后重新上传，上传后将自动替换旧版本并重新提交审核。
              </div>
            </div>
          )}
          {/* 虚线边框上传区 */}
          <div
            className="flex h-[120px] cursor-pointer flex-col items-center justify-center gap-[10px] rounded-[12px] border-2 border-dashed transition-colors"
            style={{
              borderColor: dragOver
                ? "var(--color-primary)"
                : "var(--border-main)",
              backgroundColor: dragOver
                ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                : "transparent",
            }}
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {file ? (
              <>
                <FileIcon size={32} />
                <span className="text-[13px] font-medium text-[var(--text-primary)]">
                  {file.name}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {(file.size / 1024).toFixed(1)} KB · 点击重新选择
                </span>
              </>
            ) : (
              <>
                <UploadIcon size={32} className="text-[var(--text-muted)]" />
                <span className="text-[13px] text-[var(--text-muted)]">
                  拖放或点击上传
                </span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".zip,.skill"
              onChange={handleChange}
              style={{ display: "none" }}
            />
          </div>

          {/* 技能类型选择（始终可见，默认跟随当前 tab，可手动修改） */}
          <div className="mt-[14px]">
            <label className="text-[12px] font-medium text-[var(--text-secondary)]">
              技能类型
            </label>
            <div className="mt-[6px] flex gap-[8px]">
              <button
                type="button"
                onClick={() => setSkillType('enterprise')}
                className="rounded-[6px] border px-[12px] py-[6px] text-[12px] transition-colors"
                style={{
                  borderColor: skillType === 'enterprise' ? 'var(--color-primary)' : 'var(--border-main)',
                  backgroundColor: skillType === 'enterprise' ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                  color: skillType === 'enterprise' ? 'var(--color-primary)' : 'var(--text-secondary)',
                }}
              >
                企业级技能
              </button>
              <button
                type="button"
                onClick={() => setSkillType('marketplace')}
                className="rounded-[6px] border px-[12px] py-[6px] text-[12px] transition-colors"
                style={{
                  borderColor: skillType === 'marketplace' ? 'var(--color-primary)' : 'var(--border-main)',
                  backgroundColor: skillType === 'marketplace' ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                  color: skillType === 'marketplace' ? 'var(--color-primary)' : 'var(--text-secondary)',
                }}
              >
                外部技能市场
              </button>
            </div>
            <p className="mt-[4px] text-[11px] text-[var(--text-muted)]">
              企业级技能仅本企业可见；外部技能将发布到技能市场供全员浏览。
            </p>
          </div>

          {/* 使用范围选择（始终可见） */}
          <div className="mt-[14px]">
            <label className="text-[12px] font-medium text-[var(--text-secondary)]">
              使用范围
            </label>
            <div className="mt-[6px] flex gap-[8px]">
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

            {/* 指定人员时展开部门+人员选择（下拉+搜索多选） */}
            {scopeType === 'specified' && (
              <div className="mt-[10px] flex gap-[12px]">
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
            <p className="mt-[4px] text-[11px] text-[var(--text-muted)]">
              选择「全部人员」则该技能对所有员工可见；选择「指定人员」则仅选中部门和人员可见。
            </p>
          </div>

          {/* 格式规则说明 */}
          <div className="mt-[12px] text-[12px] leading-[18px] text-[var(--text-muted)]">
            <p>
              zip 或 .skill 格式；根目录须含 SKILL.md 文件，且
              SKILL.md 内需包含 YAML 编写的技能名称与描述。
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div
          className="flex shrink-0 items-center justify-end gap-[8px] border-t-[0.5px] px-[24px] py-[16px]"
          style={{ borderColor: "var(--border-main)" }}
        >
          <button
            onClick={() => { resetState(); onClose(); }}
            className="btn-cancel"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="btn-primary"
            disabled={!file}
            style={{
              opacity: file ? 1 : 0.4,
              cursor: file ? "pointer" : "not-allowed",
            }}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadSkillModal;
