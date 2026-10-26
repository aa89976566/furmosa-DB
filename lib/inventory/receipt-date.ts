/** Actual receipt date is independent of the system posting timestamp. */
export function parseReceiptDate(value: string): Date | null {
  const text = value.trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('進貨日期格式不正確');
  const date = new Date(`${text}T12:00:00+08:00`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new Error('進貨日期不存在');
  }
  return date;
}
