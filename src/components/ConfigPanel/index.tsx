import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useWorkspace } from '../../workspace';
import type { IPluginConfig } from '../../types';
import { parseInstructorMapping } from '../../types';
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
      { label: '系统编码（→ 平台名）', key: 'platformFieldId' },
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
];

const feedbackFieldGroup = {
  title: '回传表字段',
  fields: [
    { label: '异常记录编码（关联键）', key: 'feedbackRecordCodeFieldId' },
    { label: '回传状态', key: 'feedbackStatusFieldId' },
    { label: '反馈结果', key: 'feedbackResultFieldId' },
    { label: '反馈时间', key: 'feedbackTimeFieldId' },
    { label: '反馈人', key: 'feedbackPersonFieldId' },
    { label: '是否超时', key: 'feedbackIsTimeoutFieldId' },
  ],
};

const ConfigPanel = React.memo(function ConfigPanel({ config, setConfig, onSave }: Props) {
  const { base: workspaceBase, switchBase, loadBaseList, baseList } = useWorkspace();
  const [tables, setTables] = useState<TableMeta[]>([]);
  const [fields, setFields] = useState<FieldMeta[]>([]);
  const [feedbackFields, setFeedbackFields] = useState<FieldMeta[]>([]);

  // 下拉选项按名称 A→Z 排序
  const sortedBaseList = useMemo(() => [...baseList].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), [baseList]);
  const sortedTables = useMemo(() => [...tables].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), [tables]);
  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), [fields]);
  const sortedFeedbackFields = useMemo(() => [...feedbackFields].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')), [feedbackFields]);
  const [tableLoading, setTableLoading] = useState(false);
  const [instructorRows, setInstructorRows] = useState<{ department: string; deptInstructors: string; sharedInstructors: string }[]>(() => {
    try { return JSON.parse(config.instructorMapping || '[]'); } catch { return []; }
  });
  const [platformDeptRows, setPlatformDeptRows] = useState<{ platformCode: string; platformName: string; department: string }[]>(() => {
    try { return JSON.parse(config.platformDeptMapping || '[]'); } catch { return []; }
  });

  // 外部 config 变化时同步 instructorRows（如加载已保存配置）
  // 使用 ref 避免因自身编辑导致的循环更新
  const isInternalUpdate = useRef(false);
  useEffect(() => {
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    try {
      const fromConfig = JSON.parse(config.instructorMapping || '[]');
      setInstructorRows(fromConfig);
    } catch { /* ignore */ }
  }, [config.instructorMapping]);

  // 同步 platformDeptRows
  const isPlatformDeptInternalUpdate = useRef(false);
  useEffect(() => {
    if (isPlatformDeptInternalUpdate.current) {
      isPlatformDeptInternalUpdate.current = false;
      return;
    }
    try {
      const fromConfig = JSON.parse(config.platformDeptMapping || '[]');
      setPlatformDeptRows(fromConfig);
    } catch { /* ignore */ }
  }, [config.platformDeptMapping]);

  useEffect(() => { loadBaseList(); }, []);

  useEffect(() => {
    if (config.baseToken) switchBase(config.baseToken);
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

  useEffect(() => {
    if (!workspaceBase || !config.tableId) return;
    workspaceBase.getTable(config.tableId).then(async (table: any) => {
      let metas: any[];
      try { const view = await table.getActiveView(); metas = await view.getFieldMetaList(); }
      catch { metas = await table.getFieldMetaList(); }
      setFields((metas || []).map((m: any) => ({ id: m.id, name: m.name })));
    }).catch((err: Error) => console.error('加载字段列表失败:', err));
  }, [workspaceBase, config.tableId]);

  useEffect(() => {
    if (!workspaceBase || !config.feedbackTableId) { setFeedbackFields([]); return; }
    workspaceBase.getTable(config.feedbackTableId).then(async (table: any) => {
      let metas: any[];
      try { const view = await table.getActiveView(); metas = await view.getFieldMetaList(); }
      catch { metas = await table.getFieldMetaList(); }
      setFeedbackFields((metas || []).map((m: any) => ({ id: m.id, name: m.name })));
    }).catch((err: Error) => console.error('加载回传表字段失败:', err));
  }, [workspaceBase, config.feedbackTableId]);

  // 指导员映射变更时同步到 config
  const updateInstructorMapping = (rows: typeof instructorRows) => {
    isInternalUpdate.current = true;
    setInstructorRows(rows);
    setConfig({ ...config, instructorMapping: JSON.stringify(rows) });
  };

  // 平台-部门映射变更时同步到 config
  const updatePlatformDeptMapping = (rows: typeof platformDeptRows) => {
    isPlatformDeptInternalUpdate.current = true;
    setPlatformDeptRows(rows);
    setConfig({ ...config, platformDeptMapping: JSON.stringify(rows) });
  };

  // 实时解析预览
  const instructorPreview = parseInstructorMapping(config.instructorMapping);

  // 部门筛选列表与指导员映射同步：映射里有哪个部门，筛选里就出现哪个
  const departmentsForFilter = useMemo(() => {
    return Object.keys(instructorPreview).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [instructorPreview]);

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
                    feedbackTableId: '',
                    ...Object.fromEntries(feedbackFieldGroup.fields.map(f => [f.key, ''])),
                    platformDeptMapping: '[]',
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
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#646a73]">回传表</label>
                <select
                  value={config.feedbackTableId}
                  onChange={(e) => setConfig({
                    ...config, feedbackTableId: e.target.value,
                    ...Object.fromEntries(feedbackFieldGroup.fields.map(f => [f.key, ''])),
                  })}
                  className="h-7 w-full rounded border border-[#e5e6eb] px-2 text-xs text-[#1f2329] outline-none focus:border-[#3370ff] focus:ring-1 focus:ring-[#3370ff]"
                >
                  <option value="">-- 请选择回传表 --</option>
                  {sortedTables.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                </select>
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

          {/* 部门-指导员映射（内置编辑） */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8f959e]">部门-指导员映射</h3>
            <p className="text-xs text-[#8f959e] mb-2">直接在下方编辑，保存后实时生效</p>
            {/* 表头 */}
            <div className="flex gap-1 items-center mb-1">
              <span className="flex-1 text-xs font-medium text-[#646a73]">部门</span>
              <span className="flex-1 text-xs font-medium text-[#646a73]">业务渠道指导员</span>
              <span className="flex-[0.85] text-xs font-medium text-[#646a73]">支持部门指导员</span>
              <span className="w-6 shrink-0" />
            </div>
            <div className="space-y-1.5">
              {instructorRows.map((row, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <input
                    type="text"
                    value={row.department}
                    onChange={(e) => {
                      const next = [...instructorRows];
                      next[i] = { ...next[i], department: e.target.value };
                      updateInstructorMapping(next);
                    }}
                    placeholder="输入部门名称"
                    className="h-7 flex-1 rounded border border-[#e5e6eb] px-1.5 text-xs text-[#1f2329] outline-none focus:border-[#3370ff]"
                  />
                  <input
                    type="text"
                    value={row.deptInstructors}
                    onChange={(e) => {
                      const next = [...instructorRows];
                      next[i] = { ...next[i], deptInstructors: e.target.value };
                      updateInstructorMapping(next);
                    }}
                    placeholder="业务渠道指导员姓名"
                    className="h-7 flex-1 rounded border border-[#e5e6eb] px-1.5 text-xs text-[#1f2329] outline-none focus:border-[#3370ff]"
                  />
                  <input
                    type="text"
                    value={row.sharedInstructors}
                    onChange={(e) => {
                      const next = [...instructorRows];
                      next[i] = { ...next[i], sharedInstructors: e.target.value };
                      updateInstructorMapping(next);
                    }}
                    placeholder="支持部门指导员姓名"
                    className="h-7 flex-[0.85] rounded border border-[#e5e6eb] px-1.5 text-xs text-[#1f2329] outline-none focus:border-[#3370ff]"
                  />
                  <button
                    onClick={() => updateInstructorMapping(instructorRows.filter((_, j) => j !== i))}
                    className="h-6 w-6 flex items-center justify-center rounded text-xs text-[#ff3b30] hover:bg-[#fff2f0] shrink-0"
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => updateInstructorMapping([...instructorRows, { department: '', deptInstructors: '', sharedInstructors: '' }])}
                className="h-7 w-full rounded border border-dashed border-[#c9ccd0] text-xs text-[#3370ff] hover:bg-[#f0f5ff]"
              >
                + 添加部门
              </button>
            </div>
          </div>

          <Separator />

          {/* 平台-部门映射 */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8f959e]">平台-部门映射</h3>
            <p className="text-xs text-[#8f959e] mb-2">系统编码 → 平台名 + 归属部门（与上方指导员映射联动）</p>
            {/* 表头 */}
            <div className="flex gap-1 items-center mb-1">
              <span className="flex-1 text-xs font-medium text-[#646a73]">系统编码</span>
              <span className="flex-1 text-xs font-medium text-[#646a73]">平台名</span>
              <span className="flex-1 text-xs font-medium text-[#646a73]">归属部门</span>
              <span className="w-6 shrink-0" />
            </div>
            <div className="space-y-1.5">
              {platformDeptRows.map((row, i) => (
                <div key={i} className="flex gap-1 items-center">
                  <input
                    type="text"
                    value={row.platformCode}
                    onChange={(e) => {
                      const next = [...platformDeptRows];
                      next[i] = { ...next[i], platformCode: e.target.value };
                      updatePlatformDeptMapping(next);
                    }}
                    placeholder="系统编码"
                    className="h-7 flex-1 rounded border border-[#e5e6eb] px-1.5 text-xs text-[#1f2329] outline-none focus:border-[#3370ff]"
                  />
                  <input
                    type="text"
                    value={row.platformName}
                    onChange={(e) => {
                      const next = [...platformDeptRows];
                      next[i] = { ...next[i], platformName: e.target.value };
                      updatePlatformDeptMapping(next);
                    }}
                    placeholder="平台名称"
                    className="h-7 flex-1 rounded border border-[#e5e6eb] px-1.5 text-xs text-[#1f2329] outline-none focus:border-[#3370ff]"
                  />
                  {/* 归属部门：下拉选择，数据源来自指导员映射的部门 keys */}
                  <select
                    value={row.department}
                    onChange={(e) => {
                      const next = [...platformDeptRows];
                      next[i] = { ...next[i], department: e.target.value };
                      updatePlatformDeptMapping(next);
                    }}
                    className="h-7 flex-1 rounded border border-[#e5e6eb] px-1.5 text-xs text-[#1f2329] outline-none focus:border-[#3370ff]"
                  >
                    <option value="">-- 选择部门 --</option>
                    {departmentsForFilter.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => updatePlatformDeptMapping(platformDeptRows.filter((_, j) => j !== i))}
                    className="h-6 w-6 flex items-center justify-center rounded text-xs text-[#ff3b30] hover:bg-[#fff2f0] shrink-0"
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                onClick={() => updatePlatformDeptMapping([...platformDeptRows, { platformCode: '', platformName: '', department: '' }])}
                className="h-7 w-full rounded border border-dashed border-[#c9ccd0] text-xs text-[#3370ff] hover:bg-[#f0f5ff]"
              >
                + 添加平台
              </button>
            </div>
          </div>

          {/* 回传表字段映射 */}
          {config.feedbackTableId && (
            <>
              <Separator />
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8f959e]">回传表字段映射</h3>
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[#1f2329] mb-2 pb-1 border-b border-[#e5e6eb]">
                    {feedbackFieldGroup.title}
                  </h4>
                  <div className="grid grid-cols-1 gap-2">
                    {feedbackFieldGroup.fields.map(({ label, key }) => (
                      <FieldSelector
                        key={key}
                        label={label}
                        value={(config as any)[key] || ''}
                        options={sortedFeedbackFields}
                        onChange={(v) => setConfig({ ...config, [key]: v })}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </>
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
                    <label className="text-xs font-medium text-[#646a73]">部门权限筛选（多选）</label>
                    {departmentsForFilter.map((dept) => {
                      const selected = (config.departmentNameFilter || '').split(',').map(s => s.trim());
                      const isChecked = selected.includes(dept);
                      return (
                        <label key={dept} className="flex items-center gap-2 rounded px-1 py-0.5 cursor-pointer hover:bg-[#f5f6f8]">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              const current = (config.departmentNameFilter || '').split(',').map(s => s.trim()).filter(Boolean);
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
                    })}
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
