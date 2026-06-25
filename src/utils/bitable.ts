import { bitable } from '@lark-base-open/js-sdk';

export function getBaseInstance() {
  return bitable.base;
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
  if (cell.value !== undefined && cell.value !== null) {
    const d = new Date(cell.value);
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  return '';
}

/** 渐进式拉取：每页回调增量记录（onBatch 传本页记录）
 *  读取连续进行（无间隔），首页到达即可处理。
 *  pageSize=200（飞书 SDK 单页实际上限）。
 */
export async function getRecordListProgressive(
  tableId: string,
  onBatch: (records: { recordId: string; fields: Record<string, any> }[]) => void
): Promise<void> {
  const base = getBaseInstance();
  if (!base) return;
  try {
    const table = await base.getTable(tableId);
    let pageToken: number | undefined;
    let page = 0;
    do {
      const res = await table.getRecordsByPage({ pageSize: 200, pageToken });
      const records = (res?.records ?? []).map((r: any) => ({ recordId: r.recordId, fields: r.fields }));
      if (records.length > 0) onBatch(records);
      page++;
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
  const base = getBaseInstance();
  if (!base) return;
  const table = await base.getTable(tableId);
  await table.setCellValue(fieldId, recordId, value);
}

/** 批量更新指定记录的多个字段 */
export async function updateRecordFields(
  tableId: string,
  recordId: string,
  fields: Record<string, any>
): Promise<void> {
  const base = getBaseInstance();
  if (!base) return;
  const table = await base.getTable(tableId);
  await table.setRecord(recordId, { fields });
}
