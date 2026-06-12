import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { dashboard as defaultDashboard, DashboardState } from '@lark-base-open/js-sdk';
import { useWorkspace } from './workspace';
import { setBaseInstance, getRecordListProgressive, cellToText, cellToDate, updateRecordField, updateRecordFields, upsertRecord, getBaseInstance } from './utils/bitable';
import { StatsCards } from '@/components/StatsCards';
import { ExceptionTable } from '@/components/ExceptionTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import ConfigPanel from '@/components/ConfigPanel';
import type { ExceptionRecord, ActionType, IPluginConfig } from '@/types';
import { parseInstructorMapping, parsePlatformDeptMapping } from '@/types';

const emptyConfig: IPluginConfig = {
  baseToken: '',
  tableId: '',
  exceptionCodeFieldId: '',
  platformFieldId: '',
  handlerFieldId: '',
  statusFieldId: '',
  exceptionTypeFieldId: '',
  exceptionDetailFieldId: '',
  reviewTimeFieldId: '',
  departmentFieldId: '',
  permAccountNameFieldId: '',
  permStoreNameFieldId: '',
  permWorkOrderIdFieldId: '',
  permApplicantFieldId: '',
  permApplicantEmailFieldId: '',
  permApplicantPhoneFieldId: '',
  permUserNicknameFieldId: '',
  permUserRoleListFieldId: '',
  extStoreNameFieldId: '',
  extUserPhoneFieldId: '',
  extAccountNameFieldId: '',
  extUserNameFieldId: '',
  extUserRoleListFieldId: '',
  feedbackTableId: '',
  feedbackStatusFieldId: '',
  feedbackResultFieldId: '',
  feedbackTimeFieldId: '',
  feedbackPersonFieldId: '',
  feedbackRecordCodeFieldId: '',
  feedbackIsTimeoutFieldId: '',
  instructorMapping: JSON.stringify([
    { department: '运营一部', deptInstructors: '', sharedInstructors: '' },
    { department: '运营二部', deptInstructors: '', sharedInstructors: '' },
    { department: '运营三部', deptInstructors: '', sharedInstructors: '' },
    { department: '运营四部', deptInstructors: '', sharedInstructors: '' },
    { department: '运营五部', deptInstructors: '', sharedInstructors: '' },
  ]),
  platformDeptMapping: JSON.stringify([
    { platformCode: '', platformName: '', department: '' },
  ]),
  handlerNameFilter: '',
  departmentNameFilter: '',
};

// Parse status: normalize to Chinese
function parseStatus(val: string): ExceptionRecord['status'] {
  if (val === 'pending' || val === '待处理') return '待处理';
  if (val === 'processing' || val === '处理中' || val === 'pending_feedback' || val === '待反馈') return '处理中';
  if (val === 'completed' || val === '已完成' || val === 'resolved' || val === '已解决') return '已完成';
  return '待处理';
}

// 系统编码 → 平台名称 & 部门（从 config.platformDeptMapping 动态解析，不再硬编码）

// 异常类型 → 风险等级映射
const EXCEPTION_TYPE_RISK_MAP: Record<string, string> = {
  '核心信息不一致：手机号不一致': 'R3',
  '核心信息不一致：手机号不一致, 权限配置异常：角色不一致': 'R3',
  '账号存在性异常：无工单但后台有配置': 'R3',
  '账号存在性异常：有工单但后台无配置': 'R1',
  '权限配置异常：角色不一致': 'R2',
  '辅助信息不一致：账号名（昵称）不一致': 'R2',
  '辅助信息不一致：账号名（昵称）不一致, 权限配置异常：角色不一致': 'R2',
  '辅助信息不一致：账号名（姓名）不一致': 'R2',
  '辅助信息不一致：账号名（姓名）不一致, 权限配置异常：角色不一致': 'R2',
};

// 异常类型 → 处理时效映射
const EXCEPTION_TYPE_DEADLINE_MAP: Record<string, string> = {
  '核心信息不一致：手机号不一致': '1个工作日',
  '核心信息不一致：手机号不一致, 权限配置异常：角色不一致': '1个工作日',
  '账号存在性异常：无工单但后台有配置': '1个工作日',
  '账号存在性异常：有工单但后台无配置': '-',
  '权限配置异常：角色不一致': '3个工作日内',
  '辅助信息不一致：账号名（昵称）不一致': '-',
  '辅助信息不一致：账号名（昵称）不一致, 权限配置异常：角色不一致': '3个工作日内',
  '辅助信息不一致：账号名（姓名）不一致': '-',
  '辅助信息不一致：账号名（姓名）不一致, 权限配置异常：角色不一致': '3个工作日内',
};

// 平台-部门映射由 config.platformDeptMapping 动态提供，通过 parsePlatformDeptMapping 解析

// ─── 超时计算 ────────────────────────────────────────────

function calcTimeout(reviewTime: string, deadlineText: string, status: ExceptionRecord['status']): boolean {
  if (status === '已完成') return false;
  if (!deadlineText || deadlineText === '-') return false;
  if (!reviewTime) return false;

  const reviewDate = new Date(reviewTime);
  if (isNaN(reviewDate.getTime())) return false;

  let deadlineDays = 0;
  if (deadlineText.includes('1')) deadlineDays = 1;
  else if (deadlineText.includes('3')) deadlineDays = 3;
  else return false;

  const deadline = new Date(reviewDate);
  deadline.setDate(deadline.getDate() + deadlineDays);
  return new Date() > deadline;
}

// ─── 记录映射 ────────────────────────────────────────────

function mapFeishuRecord(
  r: any,
  cfg: IPluginConfig,
  index: number,
  platformDeptMap: ReturnType<typeof parsePlatformDeptMapping>
): ExceptionRecord {
  const recordId = r.recordId || `mock-${index}`;

  const platformCode = cellToText(r.fields[cfg.platformFieldId] ?? '');
  const platformInfo = platformDeptMap[platformCode];
  const platformName = platformInfo?.name || platformCode;

  const departmentFromMap = platformInfo?.dept || '';
  const departmentFromField = cellToText(r.fields[cfg.departmentFieldId] ?? '');
  const department = departmentFromMap || departmentFromField;

  const exceptionType = cellToText(r.fields[cfg.exceptionTypeFieldId] ?? '');

  // 审阅时间：优先用 reviewTimeFieldId，格式化为 yyyy-mm-dd
  const reviewTimeRaw = cellToDate(r.fields[cfg.reviewTimeFieldId] ?? '') || cellToText(r.fields[cfg.reviewTimeFieldId] ?? '');
  const reviewTime = reviewTimeRaw ? reviewTimeRaw.slice(0, 10) : '';

  const status = parseStatus(cellToText(r.fields[cfg.statusFieldId] ?? ''));
  const deadlineText = EXCEPTION_TYPE_DEADLINE_MAP[exceptionType] || '';

  return {
    id: recordId,
    recordId,
    exceptionCode: cellToText(r.fields[cfg.exceptionCodeFieldId] ?? ''),
    exceptionType,
    sourcePlatform: platformName,
    riskLevel: EXCEPTION_TYPE_RISK_MAP[exceptionType] || '',
    handler: cellToText(r.fields[cfg.handlerFieldId] ?? ''),
    status,
    processDeadline: reviewTime,
    deadlineText,
    feedback: '',
    createdAt: reviewTime || new Date().toLocaleString('zh-CN'),
    updatedAt: '',
    description: cellToText(r.fields[cfg.exceptionDetailFieldId] ?? ''),
    affectedCount: 0,
    department,
    reviewTime,
    isTimeout: calcTimeout(reviewTime, deadlineText, status),
    permAccountName: cellToText(r.fields[cfg.permAccountNameFieldId] ?? ''),
    permStoreName: cellToText(r.fields[cfg.permStoreNameFieldId] ?? ''),
    permWorkOrderId: cellToText(r.fields[cfg.permWorkOrderIdFieldId] ?? ''),
    permApplicant: cellToText(r.fields[cfg.permApplicantFieldId] ?? ''),
    permApplicantEmail: cellToText(r.fields[cfg.permApplicantEmailFieldId] ?? ''),
    permApplicantPhone: cellToText(r.fields[cfg.permApplicantPhoneFieldId] ?? ''),
    permUserNickname: cellToText(r.fields[cfg.permUserNicknameFieldId] ?? ''),
    permUserRoleList: cellToText(r.fields[cfg.permUserRoleListFieldId] ?? ''),
    extStoreName: cellToText(r.fields[cfg.extStoreNameFieldId] ?? ''),
    extUserPhone: cellToText(r.fields[cfg.extUserPhoneFieldId] ?? ''),
    extAccountName: cellToText(r.fields[cfg.extAccountNameFieldId] ?? ''),
    extUserName: cellToText(r.fields[cfg.extUserNameFieldId] ?? ''),
    extUserRoleList: cellToText(r.fields[cfg.extUserRoleListFieldId] ?? ''),
  };
}

// ─── 主组件 ──────────────────────────────────────────────

export default function App() {
  const { base: workspaceBase, dashboard: workspaceDashboard, switchBase } = useWorkspace();

  const [config, setConfig] = useState<IPluginConfig>(emptyConfig);
  const [allRecords, setAllRecords] = useState<ExceptionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('全部');
  const [riskFilter, setRiskFilter] = useState<string>('全部');
  const [platformFilter, setPlatformFilter] = useState<string>('全部');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ExceptionRecord | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string; description: string; confirmText: string;
    actionType: 'confirm';
    instructors?: string[];
  } | null>(null);
  const instructorMapRef = useRef<Record<string, string[]>>(
    parseInstructorMapping(emptyConfig.instructorMapping)
  );

  /** 取指定部门的指导员列表，无匹配时 fallback 到全部已知指导员（去重） */
  const getInstructorsForDept = useCallback((department: string) => {
    const map = instructorMapRef.current;
    // 精确匹配
    const matched = map[department];
    if (matched && matched.length > 0) return matched;
    // 模糊匹配（部门名可能带前后缀）
    for (const [key, names] of Object.entries(map)) {
      if (key && names.length > 0 && (
        (department && (key.includes(department) || department.includes(key)))
      )) {
        return names;
      }
    }
    // fallback：合并全部已知指导员
    const all = new Set(Object.values(map).flat());
    if (all.size > 0) {
      console.warn(`[指导员] 部门「${department || '(空)'}」无匹配，已 fallback 到全量指导员`);
      return [...all].sort();
    }
    return [];
  }, []);

  const isCreate = defaultDashboard.state === DashboardState.Create;
  const isConfig = defaultDashboard.state === DashboardState.Config || isCreate;

  // Phase 1: load config
  useEffect(() => {
    if (isCreate) return;
    defaultDashboard.getConfig().then(async (res: any) => {
      const { customConfig, dataConditions } = res;
      const baseToken = dataConditions?.[0]?.baseToken || '';
      const merged = { ...emptyConfig, ...customConfig, ...(baseToken ? { baseToken } : {}) };
      setConfig(merged);
      if (baseToken) await switchBase(baseToken);
      setTimeout(() => { try { defaultDashboard.setRendered(); } catch {} }, 2000);
    }).catch(() => {
      setTimeout(() => { try { defaultDashboard.setRendered(); } catch {} }, 2000);
    });
  }, []);

  // Phase 2: set base instance
  useEffect(() => {
    if (workspaceBase) setBaseInstance(workspaceBase);
  }, [workspaceBase]);

  // Phase 2.5: parse instructor mapping from config JSON
  useEffect(() => {
    const map = parseInstructorMapping(config.instructorMapping);
    if (Object.keys(map).length > 0) {
      instructorMapRef.current = map;
    }
  }, [config.instructorMapping]);

  // Phase 3: fetch data
  const fetchData = useCallback(async (cfg: IPluginConfig) => {
    if (!cfg.tableId || !cfg.statusFieldId) return;
    try {
      // 一次性预解析，避免 mapFeishuRecord 每条记录都 JSON.parse
      const platformDeptMap = parsePlatformDeptMapping(cfg.platformDeptMapping || '');
      let allMapped: ExceptionRecord[] = [];

      await getRecordListProgressive(cfg.tableId, (batch) => {
        const mapped = batch.map((r: any, i: number) => mapFeishuRecord(r, cfg, i, platformDeptMap));
        allMapped = [...allMapped, ...mapped];
        setAllRecords([...allMapped]);
      });

      // 回传表状态覆盖 + 超时自动回传
      if (cfg.feedbackTableId && cfg.feedbackStatusFieldId && cfg.feedbackRecordCodeFieldId) {
        try {
          const base = getBaseInstance();
          if (base) {
            const fbTable = await base.getTable(cfg.feedbackTableId);
            const fbRes = await fbTable.getRecords({ pageSize: 500 });
            const fbRecords = fbRes?.records ?? [];
            const statusByCode: Record<string, string> = {};
            for (const fb of fbRecords) {
              const code = cellToText(fb.fields[cfg.feedbackRecordCodeFieldId] ?? '');
              const st = cellToText(fb.fields[cfg.feedbackStatusFieldId] ?? '');
              if (code) statusByCode[code] = st;
            }

            // 合并回传表状态 + 动态计算超时
            allMapped = allMapped.map((r) => {
              const fbStatus = statusByCode[r.exceptionCode];
              const newStatus = fbStatus ? parseStatus(fbStatus) : r.status;
              const timeout = calcTimeout(r.reviewTime, r.deadlineText || '', newStatus);
              return { ...r, status: newStatus, isTimeout: timeout };
            });

            // 超时自动回传：用 upsert 批量写入
            if (cfg.feedbackIsTimeoutFieldId) {
              const timeoutRecords = allMapped.filter((r) => r.isTimeout);
              for (const r of timeoutRecords) {
                try {
                  await upsertRecord(
                    cfg.feedbackTableId,
                    cfg.feedbackRecordCodeFieldId,
                    r.exceptionCode,
                    { [cfg.feedbackIsTimeoutFieldId]: '是' }
                  );
                } catch (e) {
                  console.warn('超时回传失败:', r.exceptionCode, e);
                }
              }
            }
          }
        } catch (e) {
          console.warn('读取回传表状态失败', e);
        }
      }

      setAllRecords(allMapped);
    } catch (e) {
      console.error('[fetchData] 数据拉取失败:', e);
    }
  }, []);

  // Fetch when config ready
  const dataConfigKey = `${config.tableId}|${config.statusFieldId}|${config.exceptionTypeFieldId}|${config.platformFieldId}|${config.handlerFieldId}|${config.exceptionDetailFieldId}|${config.departmentFieldId}|${config.reviewTimeFieldId}|${config.exceptionCodeFieldId}`;
  useEffect(() => {
    if (!config.tableId || !config.statusFieldId) return;
    if (isCreate) return;
    fetchData(config);
  }, [dataConfigKey, isCreate]);

  // 筛选
  const records = useMemo(() => {
    let result = allRecords;
    if (config.handlerNameFilter) {
      const kw = config.handlerNameFilter.trim().toLowerCase();
      result = result.filter(r => r.handler.toLowerCase().includes(kw));
    }
    if (config.departmentNameFilter) {
      const selectedDepts = config.departmentNameFilter.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
      if (selectedDepts.length > 0) {
        result = result.filter(r => selectedDepts.includes(r.department.toLowerCase()));
      }
    }
    return result;
  }, [allRecords, config.handlerNameFilter, config.departmentNameFilter]);

  // Listen for data changes (用 ref 避免 config 对象变化导致反复重订阅)
  const configRef = useRef(config);
  configRef.current = config;
  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  useEffect(() => {
    const activeDashboard = workspaceDashboard || defaultDashboard;
    if (!activeDashboard || typeof activeDashboard.onDataChange !== 'function') return;
    const off = activeDashboard.onDataChange(() => {
      const cfg = configRef.current;
      if (cfg.tableId) fetchDataRef.current(cfg);
    });
    return () => off();
  }, [workspaceDashboard]);

  // Save config
  const handleSaveConfig = useCallback(() => {
    const dash = workspaceDashboard || defaultDashboard;
    if (!dash || typeof dash.saveConfig !== 'function') return;
    dash.saveConfig({
      customConfig: config,
      dataConditions: [{ baseToken: config.baseToken, tableId: config.tableId }],
    } as any);
    // 保存后重新解析指导员映射
    const map = parseInstructorMapping(config.instructorMapping);
    if (Object.keys(map).length > 0) {
      instructorMapRef.current = map;
    }
    fetchData(config);
  }, [config, workspaceDashboard, fetchData]);

  // Actions
  const handleViewDetail = useCallback((record: ExceptionRecord) => {
    setSelectedRecord(record);
    setDetailDrawerOpen(true);
  }, []);

  const handleRecordsBatchUpdate = useCallback((
    recordId: string,
    updater: (r: ExceptionRecord) => ExceptionRecord
  ) => {
    setAllRecords((prev) => prev.map((r) => r.id === recordId ? updater(r) : r));
  }, []);

  const handleAction = useCallback((action: ActionType, record: ExceptionRecord) => {
    setSelectedRecord(record);
    switch (action) {
      case 'view': setDetailDrawerOpen(true); break;
      case 'confirm':
        setConfirmAction({
          title: '确认核查',
          description: `确认对异常 ${record.exceptionCode} 进行核查？`,
          confirmText: '确认核查',
          actionType: 'confirm',
          instructors: getInstructorsForDept(record.department),
        });
        setConfirmDialogOpen(true);
        break;
      case 'feedback': setFeedbackDialogOpen(true); break;
    }
  }, []);

  // ─── 反馈提交 ─────────────────────────────────────────────

  const handleFeedbackSubmit = useCallback(
    async (recordId: string, feedback: string, handler: string) => {
      // 本地状态立即更新（status='已完成' → calcTimeout 返回 false，无需手动置 isTimeout）
      handleRecordsBatchUpdate(recordId, (r) => ({
        ...r,
        status: '已完成' as const,
        feedback,
        handler,
      }));

      try {
        const currentRecord = selectedRecord ?? allRecords.find((r) => r.id === recordId);
        const code = currentRecord?.exceptionCode;

        if (config.feedbackTableId && code && config.feedbackRecordCodeFieldId) {
          const fbFields: Record<string, any> = {};
          if (config.feedbackStatusFieldId) fbFields[config.feedbackStatusFieldId] = '已反馈';
          if (config.feedbackResultFieldId) fbFields[config.feedbackResultFieldId] = feedback;
          if (config.feedbackTimeFieldId) fbFields[config.feedbackTimeFieldId] = Date.now();
          if (config.feedbackPersonFieldId) fbFields[config.feedbackPersonFieldId] = handler;

          await upsertRecord(config.feedbackTableId, config.feedbackRecordCodeFieldId, code, fbFields);
        }

        await updateRecordField(config.tableId, recordId, config.statusFieldId, '已完成');
      } catch (e) {
        console.error('反馈失败:', e);
      }
    },
    [config, selectedRecord, allRecords, handleRecordsBatchUpdate]
  );

  // ─── 确认核查 ─────────────────────────────────────────────

  const handleConfirmAction = useCallback(async (selectedInstructor: string) => {
    if (!confirmAction || !selectedRecord) return;
    if (!selectedInstructor) return;
    const rid = selectedRecord.id;
    const code = selectedRecord.exceptionCode;
    const handler = selectedInstructor;

    handleRecordsBatchUpdate(rid, (r) => ({
      ...r,
      status: '处理中' as const,
      handler,
    }));

    try {
      const updateFields: Record<string, any> = {};
      updateFields[config.statusFieldId] = '处理中';
      if (config.handlerFieldId) updateFields[config.handlerFieldId] = handler;
      await updateRecordFields(config.tableId, rid, updateFields);

      if (config.feedbackTableId && code && config.feedbackRecordCodeFieldId) {
        const fbFields: Record<string, any> = {};
        if (config.feedbackStatusFieldId) fbFields[config.feedbackStatusFieldId] = '处理中';
        if (config.feedbackTimeFieldId) fbFields[config.feedbackTimeFieldId] = Date.now();
        if (config.feedbackPersonFieldId) fbFields[config.feedbackPersonFieldId] = handler;

        await upsertRecord(config.feedbackTableId, config.feedbackRecordCodeFieldId, code, fbFields);
      }
    } catch (e) {
      console.error('操作失败:', e);
    }

    setConfirmAction(null);
  }, [confirmAction, selectedRecord, config, handleRecordsBatchUpdate]);

  const handleStatusClick = useCallback((status: string) => {
    setStatusFilter((prev) => prev === status ? '全部' : status);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <div className="flex">
        <div className="flex-1 min-w-0">
          <main className="mx-auto max-w-[1400px] space-y-6 p-6">
            <StatsCards
              records={records}
              onStatusClick={handleStatusClick}
              activeStatus={statusFilter === '全部' ? undefined : statusFilter}
            />
            <ExceptionTable
              records={records}
              statusFilter={statusFilter}
              riskFilter={riskFilter}
              platformFilter={platformFilter}
              searchKeyword={searchKeyword}
              onStatusFilterChange={setStatusFilter}
              onRiskFilterChange={setRiskFilter}
              onPlatformFilterChange={setPlatformFilter}
              onSearchKeywordChange={setSearchKeyword}
              onViewDetail={handleViewDetail}
              onAction={handleAction}
            />
          </main>
        </div>

        {isConfig && (
          <div className="w-80 lg:w-[380px] border-l border-[#e5e6eb] bg-white min-h-screen">
            <ConfigPanel config={config} setConfig={setConfig} onSave={handleSaveConfig} />
          </div>
        )}
      </div>

      <DetailDrawer record={selectedRecord} open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen} />
      <FeedbackDialog
        record={selectedRecord}
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        onSubmit={handleFeedbackSubmit}
        instructors={getInstructorsForDept(selectedRecord?.department || '')}
      />
      <ConfirmDialog
        record={selectedRecord}
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handleConfirmAction}
        title={confirmAction?.title || ''}
        description={confirmAction?.description || ''}
        confirmText={confirmAction?.confirmText || '确认'}
        instructors={confirmAction?.instructors}
      />
    </div>
  );
}
