/**
 * 台北時段／平日週末／每週五／deterministic 分散
 */

import {
  MORNING_FREQUENCIES,
  MORNING_SLOT_SPAN,
  MORNING_WEEKLY_WEEKDAY,
  MORNING_WINDOW_END_MINUTE,
  MORNING_WINDOW_START_MINUTE,
  type MorningFrequency,
} from '@/lib/line/morning/constants';
import { taipeiDateInput, taipeiWeekdayIndex } from '@/lib/taipei-date';

const TAIPEI_TZ = 'Asia/Taipei';

/** FNV-1a 32-bit：穩定、無 crypto 依賴，便於測試 */
export function hashLineUserId(lineUserId: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < lineUserId.length; i++) {
    h ^= lineUserId.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 0–29：落在 08:00–08:29 的分鐘偏移 */
export function morningSlotMinute(lineUserId: string): number {
  return hashLineUserId(lineUserId) % MORNING_SLOT_SPAN;
}

export function taipeiHourMinute(date: Date = new Date()): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TAIPEI_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return { hour, minute };
}

export function taipeiMinuteOfDay(date: Date = new Date()): number {
  const { hour, minute } = taipeiHourMinute(date);
  return hour * 60 + minute;
}

export function isWithinMorningWindow(date: Date = new Date()): boolean {
  const m = taipeiMinuteOfDay(date);
  return m >= MORNING_WINDOW_START_MINUTE && m <= MORNING_WINDOW_END_MINUTE;
}

/** 使用者 slot 是否已到（含當分鐘） */
export function isSlotDue(lineUserId: string, date: Date = new Date()): boolean {
  if (!isWithinMorningWindow(date)) return false;
  const slot = morningSlotMinute(lineUserId);
  const minuteInWindow = taipeiMinuteOfDay(date) - MORNING_WINDOW_START_MINUTE;
  return minuteInWindow >= slot;
}

export function isWeekdayTaipei(date: Date = new Date()): boolean {
  const wd = taipeiWeekdayIndex(date);
  return wd >= 1 && wd <= 5;
}

export function isWeeklySendDay(date: Date = new Date()): boolean {
  return taipeiWeekdayIndex(date) === MORNING_WEEKLY_WEEKDAY;
}

export function frequencyMatchesDay(
  frequency: MorningFrequency,
  date: Date = new Date(),
): boolean {
  if (frequency === 'daily') return true;
  if (frequency === 'weekday') return isWeekdayTaipei(date);
  if (frequency === 'weekly') return isWeeklySendDay(date);
  return false;
}

export function isValidFrequency(v: string): v is MorningFrequency {
  return (MORNING_FREQUENCIES as readonly string[]).includes(v);
}

export function morningTaipeiDate(date: Date = new Date()): string {
  return taipeiDateInput(date);
}
