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
  deptInstructors: string;          // 业务渠道指导员（主表字段，用于搜索）
  // 整改相关
  expectedCompletionTime: string;   // 预计整改完成时间
  rectificationFeedback: string;    // 整改情况反馈
  riskAction: string;               // 风险处置：排除风险 / 确存风险
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
export type ExceptionStatus = '待处理' | '整改中' | '已完结';
export type ActionType = 'view' | 'confirm' | 'feedback';

export interface IPluginConfig {
  baseToken?: string;
  tableId: string;
  // 基础字段（唯一绑定）
  exceptionCodeFieldId: string;
  platformFieldId: string;              // 系统编码
  dataPlatformNameFieldId: string;      // 平台名称（中文显示名）
  handlerFieldId: string;
  statusFieldId: string;
  exceptionTypeFieldId: string;
  exceptionDetailFieldId: string;
  reviewTimeFieldId: string;
  departmentFieldId: string;            // 归属部门
  deptInstructorsFieldId: string;       // 业务渠道指导员
  sharedInstructorsFieldId: string;     // 支持部门指导员
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
  // 反馈字段（与数据表同表）
  feedbackStatusFieldId: string;
  feedbackResultFieldId: string;          // 第一步反馈：排除理由 或 确存风险根因+措施合并
  feedbackTimeFieldId: string;
  feedbackPersonFieldId: string;
  feedbackRecordCodeFieldId: string;
  feedbackIsTimeoutFieldId: string;
  expectedCompletionTimeFieldId: string;  // 第一步：预计整改完成时间（确存风险时填写）
  rectificationFeedbackFieldId: string;   // 第二步：整改情况反馈
  // 筛选
  handlerNameFilter: string;
  departmentNameFilter: string;
}
