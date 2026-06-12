export interface ExceptionRecord {
  id: string;
  recordId: string;
  exceptionCode: string;
  exceptionType: string;
  sourcePlatform: string;
  riskLevel: string;
  handler: string;
  status: ExceptionStatus;
  processDeadline: string;
  deadlineText?: string;
  feedback: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  affectedCount: number;
  department: string;
  reviewTime: string;
  isTimeout: boolean;
  // 权限中心字段
  permAccountName: string;
  permStoreName: string;
  permWorkOrderId: string;
  permApplicant: string;
  permApplicantEmail: string;
  permApplicantPhone: string;
  permUserNickname: string;
  permUserRoleList: string;
  // 外部系统字段
  extStoreName: string;
  extUserPhone: string;
  extAccountName: string;
  extUserName: string;
  extUserRoleList: string;
}

export type RiskLevel = 'R1' | 'R2' | 'R3';
export type ExceptionStatus = '待处理' | '处理中' | '已完成';
export type ActionType = 'view' | 'confirm' | 'feedback';

export interface IPluginConfig {
  baseToken?: string;
  tableId: string;
  // 基础字段（唯一绑定）
  exceptionCodeFieldId: string;
  platformFieldId: string;
  handlerFieldId: string;
  statusFieldId: string;
  exceptionTypeFieldId: string;
  exceptionDetailFieldId: string;
  reviewTimeFieldId: string;
  departmentFieldId: string;
  // 权限中心字段
  permAccountNameFieldId: string;
  permStoreNameFieldId: string;
  permWorkOrderIdFieldId: string;
  permApplicantFieldId: string;
  permApplicantEmailFieldId: string;
  permApplicantPhoneFieldId: string;
  permUserNicknameFieldId: string;
  permUserRoleListFieldId: string;
  // 外部系统字段
  extStoreNameFieldId: string;
  extUserPhoneFieldId: string;
  extAccountNameFieldId: string;
  extUserNameFieldId: string;
  extUserRoleListFieldId: string;
  // 回传表配置
  feedbackTableId: string;
  feedbackStatusFieldId: string;
  feedbackResultFieldId: string;
  feedbackTimeFieldId: string;
  feedbackPersonFieldId: string;
  feedbackRecordCodeFieldId: string;
  feedbackIsTimeoutFieldId: string;
  // 指导员映射（JSON 字符串，直接在后台编辑）
  instructorMapping: string;
  // 平台-部门映射（JSON 字符串，替换硬编码的 PLATFORM_CODE_MAP / PLATFORM_DEPARTMENT_MAP）
  platformDeptMapping: string;
  // 筛选
  handlerNameFilter: string;
  departmentNameFilter: string;
}

/** 部门-指导员配置（从配置表动态读取） */
export interface DepartmentInstructorConfig {
  department: string;
  deptInstructors: string;
  sharedInstructors: string;
}

/** 平台-部门映射配置 */
export interface PlatformDeptConfig {
  platformCode: string;
  platformName: string;
  department: string;
}

/** 解析平台-部门映射 JSON → { platformCode → { name, dept } } */
export function parsePlatformDeptMapping(json: string): Record<string, { name: string; dept: string }> {
  try {
    const configs: PlatformDeptConfig[] = JSON.parse(json || '[]');
    const map: Record<string, { name: string; dept: string }> = {};
    for (const cfg of configs) {
      const code = cfg.platformCode?.trim();
      if (!code) continue;
      map[code] = {
        name: cfg.platformName?.trim() || code,
        dept: cfg.department?.trim() || '',
      };
    }
    return map;
  } catch {
    return {};
  }
}

/** 解析指导员映射 JSON → 部门名: 指导员数组 */
export function parseInstructorMapping(json: string): Record<string, string[]> {
  try {
    const configs: DepartmentInstructorConfig[] = JSON.parse(json || '[]');
    const map: Record<string, string[]> = {};
    for (const cfg of configs) {
      const dept = cfg.department?.trim();
      if (!dept) continue;
      const deptList = (cfg.deptInstructors || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
      const sharedList = (cfg.sharedInstructors || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
      map[dept] = [...new Set([...deptList, ...sharedList])];
    }
    return map;
  } catch {
    return {};
  }
}

export const STATUS_OPTIONS = [
  { label: '全部状态', value: '全部' },
  { label: '待处理', value: '待处理' },
  { label: '处理中', value: '处理中' },
  { label: '已完成', value: '已完成' },
];

export const RISK_LEVEL_OPTIONS = [
  { label: '全部等级', value: '全部' },
  { label: 'R3 - 高风险', value: 'R3' },
  { label: 'R2 - 中风险', value: 'R2' },
  { label: 'R1 - 低风险', value: 'R1' },
];
