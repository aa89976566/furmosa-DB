/** 以台北日期找出該週週一，只拿來標示 13 週，不產生金額。 */
export function taipeiMonday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [year, month, day] = parts.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  const weekday = date.getUTCDay();
  const offset = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
