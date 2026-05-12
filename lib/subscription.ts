/**
 * 訂閱制相關的計算工具
 *
 * 出貨日邏輯：
 *  - 每個方案有 `shipDays`（如 [15] 或 [1, 15]）
 *  - 從 startDate 開始，每個月在這幾天會出貨
 *  - 若該月當天 < startDate，則跳到下個月
 *  - 若 endDate 存在且 < 預定日，停止
 */

import { addMonths, isAfter, isBefore, isEqual, setDate } from 'date-fns';

export interface ShipmentSchedule {
  scheduledDate: Date;
}

export function parseShipDays(raw: string | null | undefined): number[] {
  if (!raw) return [15];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      const days = v.filter((x): x is number => typeof x === 'number' && x >= 1 && x <= 28);
      return days.length > 0 ? days.sort((a, b) => a - b) : [15];
    }
  } catch {
    // ignore
  }
  return [15];
}

export interface PlanContent {
  name: string;
  weight?: string;
  note?: string;
}

export function parsePlanContents(raw: string | null | undefined): PlanContent[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      return v.filter(
        (x): x is PlanContent => typeof x === 'object' && x !== null && typeof (x as { name?: unknown }).name === 'string',
      );
    }
  } catch {
    // ignore
  }
  return [];
}

export interface PlanBonus {
  name: string;
  interval?: string; // monthly / quarterly
}

export function parsePlanBonus(raw: string | null | undefined): PlanBonus[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) {
      return v.filter(
        (x): x is PlanBonus => typeof x === 'object' && x !== null && typeof (x as { name?: unknown }).name === 'string',
      );
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * 計算 [start, end] 期間內，該訂閱應該出貨的日期清單。
 */
export function generateShipmentDates(input: {
  startDate: Date;
  endDate?: Date | null;
  shipDays: number[];
  rangeStart: Date;
  rangeEnd: Date;
}): Date[] {
  const { startDate, endDate, shipDays, rangeStart, rangeEnd } = input;
  if (shipDays.length === 0) return [];
  if (isAfter(startDate, rangeEnd)) return [];
  if (endDate && isBefore(endDate, rangeStart)) return [];

  const begin = isBefore(startDate, rangeStart) ? rangeStart : startDate;
  const finish = endDate && isBefore(endDate, rangeEnd) ? endDate : rangeEnd;

  const out: Date[] = [];
  // iterate by month from begin to finish
  let cursor = new Date(begin.getFullYear(), begin.getMonth(), 1);
  const lastMonth = new Date(finish.getFullYear(), finish.getMonth(), 1);
  while (!isAfter(cursor, lastMonth)) {
    for (const d of shipDays) {
      const candidate = setDate(cursor, d);
      // candidate must be >= subscription startDate (so the first month doesn't include past days before sub started)
      if (isBefore(candidate, startDate)) continue;
      // candidate must be in range
      if (isBefore(candidate, rangeStart)) continue;
      if (isAfter(candidate, finish) && !isEqual(candidate, finish)) continue;
      out.push(candidate);
    }
    cursor = addMonths(cursor, 1);
  }
  return out;
}

/**
 * 取下一個出貨日（從某個基準時間之後最近的一次）。
 */
export function getNextShipmentDate(input: {
  startDate: Date;
  endDate?: Date | null;
  shipDays: number[];
  after?: Date;
}): Date | null {
  const after = input.after ?? new Date();
  // 往後找 12 個月應該夠
  const horizon = addMonths(after, 12);
  const dates = generateShipmentDates({
    startDate: input.startDate,
    endDate: input.endDate,
    shipDays: input.shipDays,
    rangeStart: after,
    rangeEnd: horizon,
  });
  return dates.length > 0 ? dates[0] : null;
}

/**
 * 訂閱是否已到期（halfyear 結束 / 手動取消 / 過期）
 */
export function isSubscriptionExpired(sub: { status: string; endDate?: Date | null }, now: Date = new Date()): boolean {
  if (sub.status === 'cancelled' || sub.status === 'expired') return true;
  if (sub.endDate && isBefore(sub.endDate, now)) return true;
  return false;
}
