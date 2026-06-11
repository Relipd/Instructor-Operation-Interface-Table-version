import { bitable } from '@lark-base-open/js-sdk';

/** 优先使用 workspace 传入的实例，否则回退到默认 bitable.base */
let _baseOverride: any = null;

export function setBaseInstance(base: any) {
  _baseOverride = base;
}

export function getBaseInstance() {
  return _baseOverride || bitable.base;
}

/** 从单元格值中提取文本 */
export function cellToText(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'string') return cell;
  if (typeof cell === 'number') return String(cell);
  if (typeof cell === 'boolean') return String(cell);
  if (Array.isArray(cell)) {
    return cell.map((v: any) => v.text || v.name || String(v)).join(', ');
  }
  if (cell.text != null) return cell.text;
  if (cell.name != null) return cell.name;
  return String(cell);
}

/** 从单元格值中提取日期字符串 */
export function cellToDate(cell: any): string {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'number') {
    const d = new Date(cell);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  if (typeof cell === 'string') return cell;
  if (cell.value) {
    const d = new Date(cell.value);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  return '';
}

export interface FieldMeta {
  id: string;
  name: string;
}

/** 获取表的字段列表 */
export async function getFieldList(tableId: string): Promise<FieldMeta[]> {
  const table = await getBaseInstance().getTable(tableId);
  const metas = await table.getFieldMetaList();
  return metas.map((m: any) => ({ id: m.id, name: m.name }));
}

/** 渐进式拉取：首屏到达立即回调，后续分批追加 */
export async function getRecordListProgressive(
  tableId: string,
  onBatch: (records: { recordId: string; fields: Record<string, any> }[]) => void
): Promise<void> {
  const base = getBaseInstance();
  if (!base) return;
  try {
    const table = await base.getTable(tableId);
    let pageToken: string | undefined;
    let page = 0;
    let total = 0;
    do {
      const res = await table.getRecordsByPage({ pageSize: 200, pageToken });
      const records = (res?.records ?? []).map((r: any) => ({ recordId: r.recordId, fields: r.fields }));
      if (records.length > 0) onBatch(records);
      page++;
      total += records.length;
      pageToken = res?.hasMore ? (res.pageToken ?? undefined) : undefined;
    } while (pageToken !== undefined && page < 100);
  } catch (e) {
    console.error('[getRecordListProgressive] 获取记录失败:', e);
  }
}

/** 更新指定记录的指定字段 */
export async function updateRecordField(
  tableId: string,
  recordId: string,
  fieldId: string,
  value: any
): Promise<void> {
  const table = await getBaseInstance().getTable(tableId);
  await table.setCellValue(fieldId, recordId, value);
}

/** 向指定表新增一条记录 */
export async function addRecord(
  tableId: string,
  fields: Record<string, any>
): Promise<string | null> {
  const table = await getBaseInstance().getTable(tableId);
  try {
    const res = await table.addRecord({ fields });
    return res.recordId;
  } catch (e) {
    console.error('Add record error:', e);
    return null;
  }
}

/** 在指定表中按字段值查找记录，返回第一条匹配的 recordId（遍历全表） */
export async function findRecordByField(
  tableId: string,
  fieldId: string,
  value: string
): Promise<string | null> {
  const base = getBaseInstance();
  if (!base) return null;
  try {
    const table = await base.getTable(tableId);
    let pageToken: string | undefined;
    let page = 0;
    do {
      const res = await table.getRecordsByPage({ pageSize: 200, pageToken });
      const records = res?.records ?? [];
      for (const r of records) {
        const cellText = cellToText(r.fields[fieldId]);
        if (cellText === value) return r.recordId;
      }
      page++;
      pageToken = res?.hasMore ? (res.pageToken ?? undefined) : undefined;
    } while (pageToken !== undefined && page < 100);
    return null;
  } catch (e) {
    console.error('Find record error:', e);
    return null;
  }
}

/** 批量更新指定记录的多个字段 */
export async function updateRecordFields(
  tableId: string,
  recordId: string,
  fields: Record<string, any>
): Promise<void> {
  const table = await getBaseInstance().getTable(tableId);
  await table.setRecord(recordId, { fields });
}

/** 构建字段值 → recordId 的索引，用于批量查找替代 N+1 查询 */
export async function buildRecordIndex(
  tableId: string,
  fieldId: string
): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  const base = getBaseInstance();
  if (!base) return index;
  try {
    const table = await base.getTable(tableId);
    let pageToken: string | undefined;
    let page = 0;
    do {
      const res = await table.getRecordsByPage({ pageSize: 200, pageToken });
      const records = res?.records ?? [];
      for (const r of records) {
        const key = cellToText(r.fields[fieldId]);
        if (key) index.set(key, r.recordId);
      }
      page++;
      pageToken = res?.hasMore ? (res.pageToken ?? undefined) : undefined;
    } while (pageToken !== undefined && page < 100);
  } catch (e) {
    console.error('[buildRecordIndex] 索引构建失败:', e);
  }
  return index;
}

/** 按关联键查找记录：存在则更新，不存在则新建 */
export async function upsertRecord(
  tableId: string,
  linkFieldId: string,
  linkValue: string,
  fields: Record<string, any>
): Promise<void> {
  const base = getBaseInstance();
  if (!base) return;
  try {
    const table = await base.getTable(tableId);
    // 尝试在已有记录中查找
    let existingRecordId: string | null = null;
    let pageToken: string | undefined;
    let page = 0;
    do {
      const res = await table.getRecordsByPage({ pageSize: 200, pageToken });
      const records = res?.records ?? [];
      for (const r of records) {
        if (cellToText(r.fields[linkFieldId]) === linkValue) {
          existingRecordId = r.recordId;
          break;
        }
      }
      if (existingRecordId) break;
      page++;
      pageToken = res?.hasMore ? (res.pageToken ?? undefined) : undefined;
    } while (pageToken !== undefined && page < 100);

    if (existingRecordId) {
      await table.setRecord(existingRecordId, { fields });
    } else {
      fields[linkFieldId] = linkValue;
      await table.addRecord({ fields });
    }
  } catch (e) {
    console.error('[upsertRecord] 写入失败:', e);
  }
}
