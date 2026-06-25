import type { ExceptionRecord } from '@/types';
import * as XLSX from 'xlsx';

const COLUMNS: { key: keyof ExceptionRecord; label: string }[] = [
  { key: 'exceptionCode', label: '异常编号' },
  { key: 'sourcePlatform', label: '平台' },
  { key: 'exceptionType', label: '异常类型' },
  { key: 'riskLevel', label: '风险等级' },
  { key: 'handler', label: '处理人' },
  { key: 'status', label: '状态' },
  { key: 'isTimeout', label: '是否超时' },
  { key: 'deadlineText', label: '处理时效' },
  { key: 'reviewTime', label: '审阅时间' },
  { key: 'department', label: '部门' },
  { key: 'description', label: '异常描述' },
  { key: 'permApplicant', label: '申请人' },
  { key: 'permApplicantEmail', label: 'CORP邮箱' },
  { key: 'permApplicantPhone', label: '手机号' },
  { key: 'permAccountName', label: '账号名称' },
  { key: 'permStoreName', label: '店铺名称' },
  { key: 'permWorkOrderId', label: '工单ID' },
  { key: 'permUserNickname', label: '用户昵称' },
  { key: 'permUserRoleList', label: '用户角色列表' },
  { key: 'extStoreName', label: '外部-店铺名称' },
  { key: 'extUserPhone', label: '外部-手机号' },
  { key: 'extAccountName', label: '外部-账号名' },
  { key: 'extUserName', label: '外部-用户姓名' },
  { key: 'extUserRoleList', label: '外部-用户角色列表' },
  { key: 'feedback', label: '反馈内容' },
  { key: 'rectificationFeedback', label: '整改反馈' },
  { key: 'expectedCompletionTime', label: '预计整改完成时间' },
  { key: 'riskAction', label: '风险处置' },
];

export function exportToExcel(records: ExceptionRecord[], filename?: string) {
  const data = records.map((r) => {
    const row: Record<string, string> = {};
    for (const col of COLUMNS) {
      const val = r[col.key];
      row[col.label] = typeof val === 'boolean' ? (val ? '是' : '否') : String(val ?? '');
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '异常记录');

  XLSX.writeFile(wb, filename || `异常记录导出_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
