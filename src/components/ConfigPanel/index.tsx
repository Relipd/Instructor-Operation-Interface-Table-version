import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useWorkspace } from '../../workspace';
import type { IPluginConfig } from '../../types';
import { cellToText } from '../../utils/bitable';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

interface Props { config: IPluginConfig; setConfig: (c: IPluginConfig) => void; onSave: () => void; }
interface FieldMeta { id: string; name: string; }
interface TableMeta { id: string; name: string; }

function FieldSelector({ label, value, options, onChange }: {
  label: string; value: string; options: FieldMeta[]; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[#646a73]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full rounded border border-[#e5e6eb] px-2 text-xs text-[#1f2329] outline-none focus:border-[#3370ff] focus:ring-1 focus:ring-[#3370ff]"
      >
        <option value="">-- 请选择 --</option>
        {options.map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
    </div>
  );
}

// ─── 字段分组（唯一绑定，无重复） ─────────────────────────

const fieldGroups: { title: string; fields: { label: string; key: keyof IPluginConfig }[] }[] = [
  {
    title: '基本信息',
    fields: [
      { label: '异常编号（索引）', key: 'exceptionCodeFieldId' },
      { label: '系统编码', key: 'platformFieldId' },
      { label: '平台名称（中文显示）', key: 'dataPlatformNameFieldId' },
      { label: '归属部门', key: 'departmentFieldId' },
      { label: '业务渠道指导员', key: 'deptInstructorsFieldId' },
      { label: '支持部门指导员', key: 'sharedInstructorsFieldId' },
      { label: '状态', key: 'statusFieldId' },
      { label: '异常类型（→ 风险等级）', key: 'exceptionTypeFieldId' },
      { label: '异常描述', key: 'exceptionDetailFieldId' },
      { label: '审阅时间（yyyy-mm-dd）', key: 'reviewTimeFieldId' },
    ],
  },
  {
    title: '权限中心',
    fields: [
      { label: '账号名称', key: 'permAccountNameFieldId' },
      { label: '店铺名称', key: 'permStoreNameFieldId' },
      { label: '工单ID', key: 'permWorkOrderIdFieldId' },
      { label: '申请人', key: 'permApplicantFieldId' },
      { label: 'CORP邮箱', key: 'permApplicantEmailFieldId' },
      { label: '手机号', key: 'permApplicantPhoneFieldId' },
      { label: '用户昵称', key: 'permUserNicknameFieldId' },
      { label: '用户角色列表', key: 'permUserRoleListFieldId' },
    ],
  },
  {
    title: '外部系统',
    fields: [
      { label: '店铺名称', key: 'extStoreNameFieldId' },
      { label: '用户手机号', key: 'extUserPhoneFieldId' },
      { label: '账号名', key: 'extAccountNameFieldId' },
      { label: '用户姓名', key: 'extUserNameFieldId' },
      { label: '用户角色列表', key: 'extUserRoleListFieldId' },
    ],
  },
  {
    title: '反馈字段（与数据表同表）',
    fields: [
      { label: '异常记录编码（关联键）', key: 'feedbackRecordCodeFieldId' },
      { label: '回传状态', key: 'feedbackStatusFieldId' },
      { label: '反馈结果（排除理由/根因+措施）', key: 'feedbackResultFieldId' },
      { label: '反馈时间', key: 'feedbackTimeFieldId' },
      { label: '反馈人', key: 'feedbackPersonFieldId' },
      { label: '是否超时', key: 'feedbackIsTimeoutFieldId' },
      { label: '预计整改完成时间', key: 'expectedCompletionTimeFieldId' },
      { label: '整改情况反馈', key: 'rectificationFeedbackFieldId' },
    ],
  },
];

const ConfigPanel = React.memo(function ConfigPanel({ config, setConfig, onSave }: Props) {
  const { base: workspaceBase, switchBase, loadBaseList, baseList } = useWorkspace();
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [fields, setFields] = useState<FieldMeta[]>([]);

  // 下拉选项按名称 A→Z 排序
  const sortedBaseList = useMemo(() => [...baseList].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), [baseList]);
  const sortedTables = useMemo(() => [...tables].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), [tables]);
  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), [fields]);
  const [tableLoading, setTableLoading] = useState(false);
  const [deptList, setDeptList] = useState<string[]>([]);
  // 缓存：tableId+deptFid → 部门列表，避免重复全表扫描
  const deptCacheRef = useRef<Map<string, string[]>>(new Map());
  const deptLoadingRef = useRef(false);

  useEffect(() => { loadBaseList(); }, []);

  useEffect(() => {
    if (config.baseToken) switchBase(config.baseToken);
    deptCacheRef.current.clear();  // 切换多维表格，清空部门缓存
  }, [config.baseToken]);

  useEffect(() => {
    if (!workspaceBase) return;
    setTableLoading(true);
    workspaceBase.getTableMetaList()
      .then((list: any[]) => {
        const mapped = (list || []).map((t: any) => ({ id: t.id, name: t.name }));
        setTables(mapped);
        if (!config.tableId && mapped.length > 0) {
          setConfig({ ...config, tableId: mapped[0].id });
        }
      })
      .catch((err: Error) => console.error('加载表列表失败:', err))
      .finally(() => setTableLoading(false));
  }, [workspaceBase]);

  // 带超时的 getActiveView()，防止 SDK 挂住
  async function loadFieldMetaList(table: any): Promise<{ id: string; name: string }[]> {
    try {
      const view = await Promise.race([
        table.getActiveView(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);
      const metas = await view.getFieldMetaList();
      return (metas || []).map((m: any) => ({ id: m.id, name: m.name }));
    } catch {
      // 超时或 getActiveView 失败 → 直接读表字段
      const metas = await table.getFieldMetaList();
      return (metas || []).map((m: any) => ({ id: m.id, name: m.name }));
    }
  }

  useEffect(() => {
    if (!workspaceBase || !config.tableId) return;
    let cancelled = false;
    workspaceBase.getTable(config.tableId).then(async (table: any) => {
      const metas = await loadFieldMetaList(table);
      if (!cancelled) setFields(metas);
    }).catch((err: Error) => console.error('加载字段列表失败:', err));
    return () => { cancelled = true; };
  }, [workspaceBase, config.tableId]);

  // 读取主表记录 → 提取部门列表用于筛选（带缓存 + 防并发）
  useEffect(() => {
    if (!workspaceBase || !config.tableId || !config.departmentFieldId) {
      setDeptList([]);
      return;
    }
    const cacheKey = `${config.tableId}|${config.departmentFieldId}`;
    // 缓存命中 → 即时返回，不发请求
    const cached = deptCacheRef.current.get(cacheKey);
    if (cached) {
      setDeptList(cached);
      return;
    }
    // 防并发：正在读则跳过
    if (deptLoadingRef.current) return;
    deptLoadingRef.current = true;

    let cancelled = false;
    const deptFid = config.departmentFieldId;
    workspaceBase.getTable(config.tableId).then(async (table: any) => {
      try {
        const depts = new Set<string>();
        let pageToken: number | undefined;
        let page = 0;
        do {
          const res: any = await table.getRecordsByPage({ pageSize: 200, pageToken });
          if (cancelled) return;
          const records = res?.records ?? [];
          for (const r of records) {
            const text = cellToText(r.fields?.[deptFid]).trim();
            if (text) depts.add(text);
          }
          page++;
          pageToken = res?.hasMore ? (res.pageToken ?? undefined) : undefined;
        } while (pageToken !== undefined && page < 100);
        if (cancelled) return;
        const sorted = [...depts].sort((a, b) => a.localeCompare(b, 'zh-CN'));
        deptCacheRef.current.set(cacheKey, sorted);  // 缓存
        setDeptList(sorted);
      } catch {
        if (!cancelled) setDeptList([]);
      } finally {
        deptLoadingRef.current = false;
      }
    }).catch(() => {
      if (!cancelled) setDeptList([]);
      deptLoadingRef.current = false;
    });
    return () => { cancelled = true; };
  }, [workspaceBase, config.tableId, config.departmentFieldId]);

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-[#e5e6eb] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#1f2329]">配置面板</h2>
      </div>

      <ScrollArea className="flex-1 px-3 py-3">
        <div className="space-y-4">
          {/* 数据源 */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8f959e]">数据源</h3>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#646a73]">多维表格</label>
                <select
                  value={config.baseToken || ''}
                  onChange={(e) => setConfig({
                    ...config, baseToken: e.target.value, tableId: '',
                    ...Object.fromEntries(fieldGroups.flatMap(g => g.fields).map(f => [f.key, ''])),
                  })}
                  className="h-7 w-full rounded border border-[#e5e6eb] px-2 text-xs text-[#1f2329] outline-none focus:border-[#3370ff] focus:ring-1 focus:ring-[#3370ff]"
                >
                  <option value="">-- 请选择 --</option>
                  {sortedBaseList.map((b) => (<option key={b.token} value={b.token}>{b.name}</option>))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#646a73]">数据表</label>
                {tableLoading ? (
                  <div className="h-7 flex items-center text-xs text-[#8f959e]">加载中...</div>
                ) : (
                  <select
                    value={config.tableId}
                    onChange={(e) => setConfig({
                      ...config, tableId: e.target.value,
                      ...Object.fromEntries(fieldGroups.flatMap(g => g.fields).map(f => [f.key, ''])),
                    })}
                    className="h-7 w-full rounded border border-[#e5e6eb] px-2 text-xs text-[#1f2329] outline-none focus:border-[#3370ff] focus:ring-1 focus:ring-[#3370ff]"
                  >
                    <option value="">-- 请选择 --</option>
                    {sortedTables.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* 字段映射 — 分组（唯一绑定） */}
          {config.tableId && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8f959e]">字段映射</h3>
              <div className="space-y-4">
                {fieldGroups.map((group) => (
                  <div key={group.title}>
                    <h4 className="text-xs font-semibold text-[#1f2329] mb-2 pb-1 border-b border-[#e5e6eb]">
                      {group.title}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {group.fields.map(({ label, key }) => (
                        <FieldSelector
                          key={key}
                          label={label}
                          value={(config as any)[key] || ''}
                          options={sortedFields}
                          onChange={(v) => setConfig({ ...config, [key]: v })}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 筛选 */}
          {config.tableId && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8f959e]">筛选</h3>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#646a73]">处理人（留空=全部）</label>
                    <Input
                      value={config.handlerNameFilter}
                      onChange={(e) => setConfig({ ...config, handlerNameFilter: e.target.value })}
                      placeholder="输入处理人姓名" className="h-7 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-[#646a73]">
                      部门权限筛选（从主表读取）
                      {deptList.length === 0 && config.tableId && config.departmentFieldId && (
                        <span className="text-[#8f959e] ml-1">— 加载中...</span>
                      )}
                    </label>
                    {(() => {
                      const selected = (config.departmentNameFilter || '').split(',').map(s => s.trim());
                      const selectedSet = new Set(selected);
                      return deptList.map((dept) => {
                        const isChecked = selectedSet.has(dept);
                        return (
                          <label key={dept} className="flex items-center gap-2 rounded px-1 py-0.5 cursor-pointer hover:bg-[#f5f6f8]">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                const current = selected.filter(Boolean);
                                const next = isChecked
                                  ? current.filter(d => d !== dept)
                                  : [...current, dept];
                                setConfig({ ...config, departmentNameFilter: next.join(',') });
                              }}
                              className="h-3.5 w-3.5 rounded border-[#c9ccd0] text-[#3370ff] focus:ring-[#3370ff]"
                            />
                            <span className="text-xs text-[#1f2329]">{dept}</span>
                          </label>
                        );
                      });
                    })()}
                    {(config.departmentNameFilter || '').split(',').filter(Boolean).length > 0 && (
                      <button
                        onClick={() => setConfig({ ...config, departmentNameFilter: '' })}
                        className="text-xs text-[#3370ff] hover:underline mt-1"
                      >
                        清除筛选
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-[#e5e6eb] p-4">
        <Button onClick={onSave} className="h-8 w-full bg-[#3370ff] text-xs hover:bg-[#2860e1]"
          disabled={!config.tableId || !config.statusFieldId}>
          保存配置
        </Button>
      </div>
    </div>
  );
});

export default ConfigPanel;
