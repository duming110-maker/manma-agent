/**
 * 部门与人员 Mock 数据（用户端）
 *
 * 变更履历：
 * - 2026-07-16 新建：为技能上传和工作事项创建的使用范围/分配范围选择器提供数据。
 *
 * 数据来源：对齐 frontend-admin/src/mock/departments.ts 和 employees.ts。
 */

/** 部门节点 */
export interface DepartmentNode {
  id: number;
  name: string;
  code: string;
  parentId?: number;
}

/** 员工节点 */
export interface EmployeeNode {
  id: number;
  name: string;
  departmentId: number;
  jobNumber: string;
}

/** 部门列表 */
export const departments: DepartmentNode[] = [
  { id: 1, name: '催收部', code: 'COLL', parentId: undefined },
  { id: 2, name: '风控部', code: 'RISK', parentId: undefined },
  { id: 3, name: '核心分析岗', code: 'RISK_CORE', parentId: 2 },
  { id: 4, name: '数据分析部', code: 'DATA', parentId: undefined },
  { id: 5, name: '房产评估部', code: 'PROP', parentId: undefined },
  { id: 6, name: '市场部', code: 'MKT', parentId: undefined },
  { id: 7, name: '信息技术部', code: 'IT', parentId: undefined },
  { id: 8, name: '财务部', code: 'FIN', parentId: undefined },
];

/** 员工列表 */
export const employees: EmployeeNode[] = [
  { id: 1, name: '陈静', departmentId: 4, jobNumber: 'EMP001' },
  { id: 2, name: '李磊', departmentId: 1, jobNumber: 'EMP002' },
  { id: 3, name: '王芳', departmentId: 2, jobNumber: 'EMP003' },
  { id: 4, name: '张明', departmentId: 7, jobNumber: 'EMP004' },
  { id: 5, name: '赵强', departmentId: 5, jobNumber: 'EMP005' },
  { id: 6, name: '孙磊', departmentId: 6, jobNumber: 'EMP006' },
  { id: 7, name: '周婷', departmentId: 2, jobNumber: 'EMP007' },
  { id: 8, name: '李伟', departmentId: 1, jobNumber: 'EMP008' },
  { id: 9, name: '刘洋', departmentId: 4, jobNumber: 'EMP009' },
  { id: 10, name: '黄丽', departmentId: 8, jobNumber: 'EMP010' },
];

/** 按 ID 查部门名称 */
export function getDeptName(id: number): string {
  return departments.find((d) => d.id === id)?.name ?? `部门#${id}`;
}

/** 按 ID 查员工名称 */
export function getEmpName(id: number): string {
  return employees.find((e) => e.id === id)?.name ?? `员工#${id}`;
}
