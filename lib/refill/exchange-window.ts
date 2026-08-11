/**
 * NT$99 換購資格視窗 — 單一來源常數與純決策函式。
 * Phase 1：無 live 建立／核銷／提醒；僅供文案、Preview、測試。
 */

import { addTaipeiCalendarDays, taipeiDateInput } from '@/lib/taipei-date';

/** 店家確認空瓶後，換購資格有效日曆天數（Asia/Taipei） */
export const REFILL_EXCHANGE_WINDOW_DAYS = 30;

/** 到期前幾天進入「即將到期」／未來提醒視窗 */
export const REFILL_EXPIRY_REMINDER_DAYS = 7;

export const REFILL_EXCHANGE_WINDOW_COPY = {
  /**
   * 加入前主卡醒目句（顧客面）。
   * 「30 天內」必須獨立 text（較大＋粗體＋wrap），不只靠顏色。
   */
  highlightLeadBefore: '⏰ 店家確認收到空瓶後，',
  highlightLeadEmphasis: '30 天內',
  highlightLeadAfter: '使用',
  /** Preview／尚未 live enforcement 標示（勿讓驗收誤認已上線；小字、不搶主資訊） */
  previewBadge: 'Preview・規則預告（尚未接 live 核銷）',
} as const;

export type ExchangeEntitlementLifecycle =
  | 'active'
  | 'expiring-soon'
  | 'redeemed'
  | 'expired';

const TAIPEI_TZ = 'Asia/Taipei';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

/** 取得瞬間在 Asia/Taipei 的時分秒毫秒（不依賴本機 TZ） */
export function getTaipeiWallClock(date: Date): {
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
} {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TAIPEI_TZ,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const second = Number(parts.find((p) => p.type === 'second')?.value ?? '0');
  const ymd = taipeiDateInput(date);
  const floored = new Date(
    `${ymd}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}.000+08:00`,
  );
  const millisecond = Math.min(
    999,
    Math.max(0, date.getTime() - floored.getTime()),
  );
  return { hour, minute, second, millisecond };
}

/**
 * activatedAt → expiresAt
 *
 * 語意（固定 Asia/Taipei，不吃本機 TZ）：
 * 1. 取 activatedAt 的台北日曆日
 * 2. 加 REFILL_EXCHANGE_WINDOW_DAYS 個台北日曆天
 * 3. 保留同一組台北牆鐘時分秒毫秒
 * 4. 回傳對應的絕對瞬間
 *
 * 例：2024-01-31 15:30+08 → 2024-03-01 15:30+08（+30 日曆天）
 */
export function computeExchangeExpiresAt(
  activatedAt: Date,
  windowDays: number = REFILL_EXCHANGE_WINDOW_DAYS,
): Date {
  if (!Number.isFinite(activatedAt.getTime())) {
    throw new Error('activatedAt 無效');
  }
  if (!Number.isInteger(windowDays) || windowDays < 1) {
    throw new Error('windowDays 須為正整數');
  }
  const startYmd = taipeiDateInput(activatedAt);
  const endYmd = addTaipeiCalendarDays(startYmd, windowDays);
  const wall = getTaipeiWallClock(activatedAt);
  return new Date(
    `${endYmd}T${pad2(wall.hour)}:${pad2(wall.minute)}:${pad2(wall.second)}.${pad3(wall.millisecond)}+08:00`,
  );
}

/** Asia/Taipei 顯示為 YYYY/MM/DD */
export function formatExchangeDeadlineDisplay(expiresAt: Date): string {
  const ymd = taipeiDateInput(expiresAt);
  const [y, m, d] = ymd.split('-');
  return `${y}/${m}/${d}`;
}

export function deriveExchangeEntitlementLifecycle(input: {
  activatedAt: Date;
  expiresAt: Date;
  redeemedAt?: Date | null;
  now?: Date;
  reminderDays?: number;
}): ExchangeEntitlementLifecycle {
  const now = input.now ?? new Date();
  if (input.redeemedAt) return 'redeemed';
  // 到期瞬間（now === expiresAt）即不可使用
  if (now.getTime() >= input.expiresAt.getTime()) return 'expired';
  const reminderDays = input.reminderDays ?? REFILL_EXPIRY_REMINDER_DAYS;
  const reminderMs = reminderDays * MS_PER_DAY;
  if (now.getTime() >= input.expiresAt.getTime() - reminderMs) {
    return 'expiring-soon';
  }
  return 'active';
}

/** 是否仍可用於核銷（Phase 2 後端會用；Phase 1 僅決策） */
export function isExchangeEntitlementUsable(input: {
  expiresAt: Date;
  redeemedAt?: Date | null;
  now?: Date;
}): boolean {
  const lifecycle = deriveExchangeEntitlementLifecycle({
    activatedAt: new Date(0),
    expiresAt: input.expiresAt,
    redeemedAt: input.redeemedAt,
    now: input.now,
  });
  return lifecycle === 'active' || lifecycle === 'expiring-soon';
}

export function shouldSendExpiryReminder(input: {
  expiresAt: Date;
  redeemedAt?: Date | null;
  reminderSentAt?: Date | null;
  now?: Date;
}): boolean {
  if (input.reminderSentAt) return false;
  return (
    deriveExchangeEntitlementLifecycle({
      activatedAt: new Date(0),
      expiresAt: input.expiresAt,
      redeemedAt: input.redeemedAt,
      now: input.now,
    }) === 'expiring-soon'
  );
}
