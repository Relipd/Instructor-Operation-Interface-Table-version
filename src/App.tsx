import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { dashboard as defaultDashboard, DashboardState } from '@lark-base-open/js-sdk';
import { useWorkspace } from './workspace';
import { getRecordListProgressive, cellToText, cellToDate, updateRecordField, updateRecordFields } from './utils/bitable';
import { StatsCards } from '@/components/StatsCards';
import { ExceptionTable } from '@/components/ExceptionTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog';
import ConfigPanel from '@/components/ConfigPanel';
import type { ExceptionRecord, ActionType, IPluginConfig } from '@/types';

const emptyConfig: IPluginConfig = {
  baseToken: '',
  tableId: '',
  exceptionCodeFieldId: '',
  platformFieldId: '',
  dataPlatformNameFieldId: '',
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
  deptInstructorsFieldId: '',
  sharedInstructorsFieldId: '',
  feedbackStatusFieldId: '',
  feedbackResultFieldId: '',
  feedbackTimeFieldId: '',
  feedbackPersonFieldId: '',
  feedbackRecordCodeFieldId: '',
  feedbackIsTimeoutFieldId: '',
  expectedCompletionTimeFieldId: '',
  rectificationFeedbackFieldId: '',
  handlerNameFilter: '',
  departmentNameFilter: '',
};

// Parse status: 底表状态字段存层级二值（排除风险/确存风险/整改完结），归一化到层级一
function parseStatus(val: string): ExceptionRecord['status'] {
  if (val === 'pending' || val === '待处理') return '待处理';
  // 确存风险（未整改反馈）→ 整改中
  if (val === 'processing' || val === '处理中' || val === '整改中' || val === '确存风险' || val === 'pending_feedback' || val === '待反馈') return '整改中';
  // 排除风险 / 整改完结 / 已完成 / 已完结 → 已完结
  if (val === 'completed' || val === '已完成' || val === '已完结' || val === 'resolved' || val === '已解决' || val === '排除风险' || val === '整改完结') return '已完结';
  return '待处理';
}

// 平台名称、部门、指导员均直接从主表字段读取

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
  '权限配置异常：角色不一致': '3个工作日',
  '辅助信息不一致：账号名（昵称）不一致': '-',
  '辅助信息不一致：账号名（昵称）不一致, 权限配置异常：角色不一致': '3个工作日',
  '辅助信息不一致：账号名（姓名）不一致': '-',
  '辅助信息不一致：账号名（姓名）不一致, 权限配置异常：角色不一致': '3个工作日',
};

// ─── 超时计算 ────────────────────────────────────────────

function calcTimeout(reviewTime: string, deadlineText: string, status: ExceptionRecord['status']): boolean {
  if (status === '已完结' || status === '整改中') return false;
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

function mapFeishuRecord(r: any, cfg: IPluginConfig, index: number): ExceptionRecord {
  const recordId = r.recordId || `mock-${index}`;

  // 平台名：主表「平台名称」字段 > 系统编码
  const platformCode = cellToText(r.fields[cfg.platformFieldId] ?? '');
  const dataPlatformName = cellToText(r.fields[cfg.dataPlatformNameFieldId] ?? '');
  const sourcePlatform = dataPlatformName || platformCode;

  // 部门：主表「归属部门」字段
  const department = cellToText(r.fields[cfg.departmentFieldId] ?? '');

  const exceptionType = cellToText(r.fields[cfg.exceptionTypeFieldId] ?? '');

  // 审阅时间：格式化为 yyyy-mm-dd
  const reviewTimeRaw = cellToDate(r.fields[cfg.reviewTimeFieldId] ?? '') || cellToText(r.fields[cfg.reviewTimeFieldId] ?? '');
  const reviewTime = reviewTimeRaw ? reviewTimeRaw.slice(0, 10) : '';

  const status = parseStatus(cellToText(r.fields[cfg.statusFieldId] ?? ''));
  const deadlineText = EXCEPTION_TYPE_DEADLINE_MAP[exceptionType] || '';

  return {
    id: recordId,
    recordId,
    exceptionCode: cellToText(r.fields[cfg.exceptionCodeFieldId] ?? ''),
    exceptionType,
    sourcePlatform,
    riskLevel: EXCEPTION_TYPE_RISK_MAP[exceptionType] || '',
    handler: cellToText(r.fields[cfg.handlerFieldId] ?? ''),
    status,
    processDeadline: reviewTime,
    deadlineText,
    feedback: cellToText(r.fields[cfg.feedbackResultFieldId] ?? ''),
    createdAt: reviewTime || new Date().toLocaleString('zh-CN'),
    updatedAt: '',
    description: cellToText(r.fields[cfg.exceptionDetailFieldId] ?? ''),
    affectedCount: 0,
    department,
    reviewTime,
    isTimeout: false,  // fetchData 中统一重算
    deptInstructors: cellToText(r.fields[cfg.deptInstructorsFieldId] ?? ''),  // 业务渠道指导员
    expectedCompletionTime: cellToDate(r.fields[cfg.expectedCompletionTimeFieldId] ?? '').slice(0, 10) || cellToText(r.fields[cfg.expectedCompletionTimeFieldId] ?? ''),
    rectificationFeedback: cellToText(r.fields[cfg.rectificationFeedbackFieldId] ?? ''),
    riskAction: cellToText(r.fields[cfg.statusFieldId] ?? ''),  // 层级二：排除风险/确存风险/整改完结（底表状态字段原始值）
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
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('全部');
  const [riskFilter, setRiskFilter] = useState<string>('全部');
  const [platformFilter, setPlatformFilter] = useState<string>('全部');
  const [exceptionTypeFilter, setExceptionTypeFilter] = useState<string>('全部');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<ExceptionRecord | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const instructorMapRef = useRef<Record<string, string[]>>({});
  const timeoutWriteRef = useRef(false);  // 超时回传进行中标记，防 onDataChange 循环
  const dataFetchedRef = useRef(false);   // 首次数据拉取完成标记（区分"等待拉取"与"拉取后无数据"）

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

  // Phase 2: 读取主表 → 构建指导员映射 + 异常记录
  const fetchData = useCallback(async (cfg: IPluginConfig) => {
    if (!cfg.tableId || !cfg.statusFieldId) return;
    setLoading(true);
    try {
      let allMapped: ExceptionRecord[] = [];
      const instMap: Record<string, Set<string>> = {};
      // 渲染节流：首屏立即刷新，后续最多 800ms 一次（3k 行 15 页 → 约 3-4 次刷新）
      let lastFlush = 0;
      let isFirstBatch = true;
      const flush = () => {
        const now = Date.now();
        if (isFirstBatch || now - lastFlush >= 800) {
          setAllRecords([...allMapped]);
          lastFlush = now;
          isFirstBatch = false;
        }
      };

      await getRecordListProgressive(cfg.tableId, (batch) => {
        for (let i = 0; i < batch.length; i++) {
          const r = batch[i];
          const rec = mapFeishuRecord(r, cfg, allMapped.length + i);
          allMapped.push(rec);
          if (rec.department) {
            if (!instMap[rec.department]) instMap[rec.department] = new Set();
            const set = instMap[rec.department];
            const deptInst = cellToText(r.fields[cfg.deptInstructorsFieldId] ?? '').split(/[,，]/);
            const sharedInst = cellToText(r.fields[cfg.sharedInstructorsFieldId] ?? '').split(/[,，]/);
            for (const s of deptInst) { const t = s.trim(); if (t) set.add(t); }
            for (const s of sharedInst) { const t = s.trim(); if (t) set.add(t); }
          }
        }
        flush();
      });
      setAllRecords([...allMapped]);  // 收尾：完整数据

      // 指导员映射 Set → 数组
      const finalInstMap: Record<string, string[]> = {};
      for (const [dept, set] of Object.entries(instMap)) {
        finalInstMap[dept] = [...set];
      }
      if (Object.keys(finalInstMap).length > 0) {
        instructorMapRef.current = finalInstMap;
      }

      // 动态计算超时（一次遍历，原地更新）
      const timeoutRecordIds: string[] = [];
      for (let i = 0; i < allMapped.length; i++) {
        const r = allMapped[i];
        const timeout = calcTimeout(r.reviewTime, r.deadlineText || '', r.status);
        if (timeout !== r.isTimeout) allMapped[i] = { ...r, isTimeout: timeout };
        if (timeout && cfg.feedbackIsTimeoutFieldId) timeoutRecordIds.push(r.recordId);
      }

      // 先刷新显示（含 isTimeout 标记），用户立即可见
      setAllRecords([...allMapped]);
      setLoading(false);
      dataFetchedRef.current = true;  // 标记首次拉取完成

      // 超时回传放后台：不阻塞显示；用 ref 标记避免 onDataChange 触发的循环回传
      if (cfg.feedbackIsTimeoutFieldId && timeoutRecordIds.length > 0 && !timeoutWriteRef.current) {
        timeoutWriteRef.current = true;
        const CONCURRENCY = 5;
        for (let i = 0; i < timeoutRecordIds.length; i += CONCURRENCY) {
          const chunk = timeoutRecordIds.slice(i, i + CONCURRENCY);
          await Promise.all(chunk.map(rid =>
            updateRecordField(cfg.tableId, rid, cfg.feedbackIsTimeoutFieldId!, '是')
              .catch(e => console.warn('超时回传失败:', rid, e))
          ));
        }
        // 回传完成后延时清 flag，让下次 onDataChange 能正常处理
        setTimeout(() => { timeoutWriteRef.current = false; }, 3000);
      }
    } catch (e) {
      console.error('[fetchData] 数据拉取失败:', e);
      setLoading(false);
      dataFetchedRef.current = true;  // 标记已尝试拉取，避免永久等待
    }
  }, []);

  // Fetch when config ready
  const dataConfigKey = `${config.tableId}|${config.statusFieldId}|${config.platformFieldId}|${config.dataPlatformNameFieldId}|${config.handlerFieldId}|${config.exceptionDetailFieldId}|${config.departmentFieldId}|${config.reviewTimeFieldId}|${config.exceptionCodeFieldId}`;
  useEffect(() => {
    if (!config.tableId || !config.statusFieldId) return;
    if (isCreate) return;
    dataFetchedRef.current = false;  // 切换表时重置，确保先显示等待态
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
        // 直接匹配主表的 department 字段
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
    // 防抖：onDataChange 短时间密集触发时，合并为一次拉取（800ms）
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = activeDashboard.onDataChange(() => {
      // 超时回传自身触发的数据变更，跳过避免循环
      if (timeoutWriteRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const cfg = configRef.current;
        if (cfg.tableId) fetchDataRef.current(cfg);
      }, 800);
    });
    return () => { if (timer) clearTimeout(timer); off(); };
  }, [workspaceDashboard]);

  // Save config
  const handleSaveConfig = useCallback(() => {
    const dash = workspaceDashboard || defaultDashboard;
    if (!dash || typeof dash.saveConfig !== 'function') return;
    dash.saveConfig({
      customConfig: config,
      dataConditions: [{ baseToken: config.baseToken, tableId: config.tableId }],
    } as any);
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
      case 'confirm': setConfirmDialogOpen(true); break;
      case 'feedback': setFeedbackDialogOpen(true); break;
    }
  }, []);

  // ─── 反馈提交 ─────────────────────────────────────────────

  // ─── 整改反馈（第二步）→ 已完结 ───────────────────────

  const handleFeedbackSubmit = useCallback(
    async (recordId: string, feedback: string, handler: string) => {
      // 本地状态立即更新
      handleRecordsBatchUpdate(recordId, (r) => {
        const prev = { status: r.status, handler: r.handler, riskAction: r.riskAction, rectificationFeedback: r.rectificationFeedback, isTimeout: r.isTimeout };
        (r as any).__prev = prev;
        return {
          ...r,
          status: parseStatus('整改完结'),  // 整改完结 → 已完结
          riskAction: '整改完结',
          rectificationFeedback: feedback,
          handler,
          isTimeout: false,
        };
      });

      try {
        // 所有字段写入同一张表（数据表=回传表）
        const fields: Record<string, any> = {};
        // 底表状态字段存层级二值：整改反馈路径写「整改完结」
        fields[config.statusFieldId] = '整改完结';
        // 回传状态字段同步写层级二值（兼容与 statusFieldId 同字段或不同字段）
        if (config.feedbackStatusFieldId) fields[config.feedbackStatusFieldId] = '整改完结';
        // 第二步：整改情况反馈（多行文本字段，直接写字符串）
        if (config.rectificationFeedbackFieldId) fields[config.rectificationFeedbackFieldId] = feedback;
        if (config.feedbackTimeFieldId) fields[config.feedbackTimeFieldId] = Date.now();
        if (config.feedbackPersonFieldId) fields[config.feedbackPersonFieldId] = handler;
        if (config.handlerFieldId) fields[config.handlerFieldId] = handler;
        // 已完结 → 清除超时标记
        if (config.feedbackIsTimeoutFieldId) fields[config.feedbackIsTimeoutFieldId] = '否';

        await updateRecordFields(config.tableId, recordId, fields);
      } catch (e) {
        console.error('整改反馈失败:', e);
        // API 失败 → 回滚本地状态
        handleRecordsBatchUpdate(recordId, (r) => {
          const p = (r as any).__prev;
          if (p) { const { __prev, ...rest } = r as any; return { ...rest, ...p }; }
          return r;
        });
      }
    },
    [config, handleRecordsBatchUpdate]
  );

  // ─── 确认核查 ─────────────────────────────────────────────

  // ─── 确认核查（第一步）→ 排除风险(已完结) / 确存风险(整改中) ──

  const handleConfirmAction = useCallback(async (payload: {
    action: 'exclude' | 'confirm';
    instructor: string;
    reason: string;
    measure?: string;
    expectedCompletionTime?: string;
  }) => {
    if (!selectedRecord) return;
    const rid = selectedRecord.id;
    const handler = payload.instructor;

    // 合并文本：排除风险只写理由；确存风险写完整信息
    const mergedFeedback = payload.action === 'exclude'
      ? payload.reason
      : `风险根因：${payload.reason}\n整改措施：${payload.measure || ''}`;

    // 层级二值（写入底表状态字段）；层级一由 parseStatus 推导
    const riskAction = payload.action === 'exclude' ? '排除风险' : '确存风险';
    const newStatus = parseStatus(riskAction);  // 排除风险→已完结, 确存风险→整改中

    // 本地状态立即更新
    handleRecordsBatchUpdate(rid, (r) => {
      // 保存原始值，API 失败时回滚
      const prev = { status: r.status, handler: r.handler, riskAction: r.riskAction, feedback: r.feedback, expectedCompletionTime: r.expectedCompletionTime, isTimeout: r.isTimeout };
      (r as any).__prev = prev;
      return {
        ...r,
        status: newStatus,
        handler,
        riskAction,
        feedback: mergedFeedback,
        expectedCompletionTime: payload.expectedCompletionTime || r.expectedCompletionTime,
        isTimeout: newStatus === '已完结' ? false : r.isTimeout,
      };
    });

    try {
      const fields: Record<string, any> = {};
      // 底表状态字段存层级二值
      fields[config.statusFieldId] = riskAction;
      if (config.handlerFieldId) fields[config.handlerFieldId] = handler;
      if (config.feedbackResultFieldId) fields[config.feedbackResultFieldId] = mergedFeedback;
      if (config.feedbackTimeFieldId) fields[config.feedbackTimeFieldId] = Date.now();
      if (config.feedbackPersonFieldId) fields[config.feedbackPersonFieldId] = handler;
      // 回传状态字段同步写层级二值（兼容与 statusFieldId 同字段或不同字段）
      if (config.feedbackStatusFieldId) fields[config.feedbackStatusFieldId] = riskAction;
      // 确存风险：写预计整改完成时间（日期字段需毫秒时间戳，飞书不接受字符串）
      if (payload.action === 'confirm' && config.expectedCompletionTimeFieldId && payload.expectedCompletionTime) {
        const ts = Date.parse(payload.expectedCompletionTime);
        if (!isNaN(ts)) fields[config.expectedCompletionTimeFieldId] = ts;
      }
      // 已完结 / 整改中 → 清除超时标记
      if (config.feedbackIsTimeoutFieldId) fields[config.feedbackIsTimeoutFieldId] = '否';

      await updateRecordFields(config.tableId, rid, fields);
    } catch (e) {
      console.error('确认核查失败:', e);
      // API 失败 → 回滚本地状态
      handleRecordsBatchUpdate(rid, (r) => {
        const p = (r as any).__prev;
        if (p) { const { __prev, ...rest } = r as any; return { ...rest, ...p }; }
        return r;
      });
    }

    setConfirmDialogOpen(false);
  }, [selectedRecord, config, handleRecordsBatchUpdate]);

  const handleStatusClick = useCallback((status: string) => {
    setStatusFilter((prev) => prev === status ? '全部' : status);
  }, []);

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <div className="flex">
        <div className="flex-1 min-w-0">
          <main className="mx-auto max-w-[1400px] space-y-3 p-4">
            {!dataFetchedRef.current && allRecords.length === 0 ? (
              // 数据尚未拉取：显示等待拉取态（含表格骨架）
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-lg bg-white border border-[#e5e6eb] animate-pulse" />
                  ))}
                </div>
                <div className="rounded-lg border border-[#e5e6eb] bg-white overflow-hidden">
                  <div className="h-10 border-b border-[#e5e6eb] bg-[#fafbfc] animate-pulse" />
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className="h-12 border-b border-[#f0f1f3] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                  <div className="flex items-center justify-center h-32 text-[#8f959e]">
                    <div className="flex flex-col items-center gap-2">
                      <svg className="h-5 w-5 animate-spin text-[#3370ff]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>正在拉取数据，请稍候…</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : loading && allRecords.length === 0 ? (
              // 数据拉取中（进度式拉取的首屏）：骨架屏占位
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-lg bg-white border border-[#e5e6eb] animate-pulse" />
                  ))}
                </div>
                <div className="rounded-lg bg-white border border-[#e5e6eb] overflow-hidden">
                  <div className="h-10 border-b border-[#e5e6eb] bg-[#fafafa] animate-pulse" />
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className="h-12 border-b border-[#f0f1f3] animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                  ))}
                </div>
              </div>
            ) : (
              <>
            <StatsCards
              records={records}
              onStatusClick={handleStatusClick}
              activeStatus={statusFilter === '全部' ? undefined : statusFilter}
            />
            <ExceptionTable
              records={records}
              loading={loading}
              statusFilter={statusFilter}
              riskFilter={riskFilter}
              platformFilter={platformFilter}
              exceptionTypeFilter={exceptionTypeFilter}
              searchKeyword={searchKeyword}
              onStatusFilterChange={setStatusFilter}
              onRiskFilterChange={setRiskFilter}
              onPlatformFilterChange={setPlatformFilter}
              onExceptionTypeFilterChange={setExceptionTypeFilter}
              onSearchKeywordChange={setSearchKeyword}
              onViewDetail={handleViewDetail}
              onAction={handleAction}
            />
              </>
            )}
          </main>
        </div>

        {isConfig && (
          <div className="w-80 lg:w-[380px] border-l border-[#e5e6eb] bg-white min-h-screen">
            <ConfigPanel config={config} setConfig={setConfig} onSave={handleSaveConfig} />
          </div>
        )}
      </div>

      <DetailDrawer record={selectedRecord} open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen} onAction={handleAction} />
      <FeedbackDialog
        record={selectedRecord}
        open={feedbackDialogOpen}
        onOpenChange={setFeedbackDialogOpen}
        onSubmit={handleFeedbackSubmit}
        instructors={getInstructorsForDept(selectedRecord?.department || '')}
      />
      <ConfirmActionDialog
        record={selectedRecord}
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onSubmit={handleConfirmAction}
        instructors={getInstructorsForDept(selectedRecord?.department || '')}
      />
    </div>
  );
}
