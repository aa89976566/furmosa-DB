const TAIPEI_TZ = 'Asia/Taipei';

/** YYYY-MM（台北日曆月）→ 該月起訖（含 end 當日 23:59:59.999） */
export function parseTaipeiMonth(month: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  const start = new Date(`${month}-01T00:00:00+08:00`);
  const nextMonth = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const end = new Date(`${nextMonth}-01T00:00:00+08:00`);
  end.setMilliseconds(end.getMilliseconds() - 1);
  return { start, end };
}

export function taipeiYearMonth(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${y}-${m}`;
}

/** 由近到遠列出 N 個台北月份（含本月） */
export function recentTaipeiMonths(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    out.push(taipeiYearMonth(d));
  }
  return out;
}

export function formatTaipeiMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y} 年 ${Number(m)} 月`;
}

/** YYYY-MM-DD（台北日曆日）→ 當日 00:00 ~ 23:59:59.999 +08:00 */
export function parseTaipeiDateRange(from: string, to: string): { start: Date; end: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T23:59:59.999+08:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;
  return { start, end };
}

/** 本月（台北）起訖，供月結預設期間 */
export function defaultTaipeiMonthRange(reference = new Date()): { start: Date; end: Date } {
  return parseTaipeiMonth(taipeiYearMonth(reference))!;
}

/** YYYY-MM-DD（台北日曆日） */
export function taipeiDateInput(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** 本月 1 日～今天（台北），供核銷報表預設期間 */
export function defaultTaipeiMonthToTodayInputs(reference = new Date()): { from: string; to: string } {
  const month = taipeiYearMonth(reference);
  return { from: `${month}-01`, to: taipeiDateInput(reference) };
}

/** 上個完整月（台北） */
export function previousTaipeiMonthInputs(reference = new Date()): { from: string; to: string } {
  const current = taipeiYearMonth(reference);
  const [y, m] = current.split('-').map(Number);
  const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  const range = parseTaipeiMonth(prevMonth)!;
  return { from: taipeiDateInput(range.start), to: taipeiDateInput(range.end) };
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** 台北日曆：星期幾（0=週日） */
export function taipeiWeekdayIndex(date: Date = new Date()): number {
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: TAIPEI_TZ,
    weekday: 'short',
  }).format(date);
  return WEEKDAY_INDEX[wd] ?? 0;
}

/** 台北日曆日期加減天數，回傳 YYYY-MM-DD */
export function addTaipeiCalendarDays(ymd: string, deltaDays: number): string {
  const base = new Date(`${ymd}T12:00:00+08:00`);
  base.setTime(base.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return taipeiDateInput(base);
}

/** 台北「今天」00:00～23:59:59.999 */
export function taipeiTodayRange(reference = new Date()): { start: Date; end: Date } {
  const day = taipeiDateInput(reference);
  return {
    start: new Date(`${day}T00:00:00+08:00`),
    end: new Date(`${day}T23:59:59.999+08:00`),
  };
}

/** 台北本週（週日起算）半開區間 [start, end) */
export function taipeiWeekRangeSunday(reference = new Date()): { start: Date; end: Date } {
  const today = taipeiDateInput(reference);
  const sunday = addTaipeiCalendarDays(today, -taipeiWeekdayIndex(reference));
  const nextSunday = addTaipeiCalendarDays(sunday, 7);
  return {
    start: new Date(`${sunday}T00:00:00+08:00`),
    end: new Date(`${nextSunday}T00:00:00+08:00`),
  };
}

/** 台北近 N 個日曆日（含今天），由舊到新 */
export function taipeiDateKeysLastNDays(n: number, reference = new Date()): string[] {
  const today = taipeiDateInput(reference);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(addTaipeiCalendarDays(today, -i));
  }
  return keys;
}

/** 台北近 N 日（含今天）起始時刻 */
export function taipeiStartOfLastNDays(n: number, reference = new Date()): Date {
  const keys = taipeiDateKeysLastNDays(n, reference);
  return new Date(`${keys[0]}T00:00:00+08:00`);
}
