const TAIPEI_OFFSET_HOURS = 8;

export function parseTaipeiSettlementMonth(value: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value.trim());
  if (!match) throw new Error('請選擇有效的對帳月份');
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (year < 2020 || year > 2100) throw new Error('對帳月份超出可接受範圍');
  return {
    periodStart: new Date(Date.UTC(year, monthIndex, 1, -TAIPEI_OFFSET_HOURS)),
    periodEnd: new Date(Date.UTC(year, monthIndex + 1, 1, -TAIPEI_OFFSET_HOURS)),
  };
}

export function currentTaipeiMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  if (!year || !month) throw new Error('無法取得目前月份');
  return `${year}-${month}`;
}
