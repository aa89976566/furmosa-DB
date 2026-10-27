import { formatPurchaseDate } from './purchase-presentation';

export function metadataSnapshot(value: unknown): { vendorId: string | null; receiptDate: string | null } {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    vendorId: typeof object.vendorId === 'string' ? object.vendorId : null,
    receiptDate: typeof object.receiptDate === 'string' ? object.receiptDate : null,
  };
}

export function metadataHistoryLines(before: unknown, after: unknown, vendorNames: ReadonlyMap<string, string>) {
  const previous = metadataSnapshot(before);
  const next = metadataSnapshot(after);
  const lines: { label: string; before: string; after: string }[] = [];
  const vendor = (id: string | null) => id ? vendorNames.get(id) ?? `廠商（${id}）` : '未填';
  const date = (value: string | null) => {
    if (!value) return '未填';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '日期資料無法辨識' : formatPurchaseDate(parsed);
  };
  if (previous.vendorId !== next.vendorId) lines.push({ label: '廠商', before: vendor(previous.vendorId), after: vendor(next.vendorId) });
  if (previous.receiptDate !== next.receiptDate) lines.push({ label: '實際進貨日期', before: date(previous.receiptDate), after: date(next.receiptDate) });
  return lines;
}
