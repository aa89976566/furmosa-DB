import { formatLocalDate, formatLocalTime } from '@/lib/booking/availability';
import { addTaipeiCalendarDays, taipeiDateInput } from '@/lib/taipei-date';

export type BookingNotifyContext = {
  merchantName: string;
  serviceName: string;
  startsAt: Date;
  petName?: string | null;
  customerName?: string | null;
};

function whenLine(startsAt: Date): string {
  return `${formatLocalDate(startsAt)} ${formatLocalTime(startsAt)}`;
}

/** 顧客：已收到申請 */
export function copyCustomerReceived(ctx: BookingNotifyContext): string {
  const pet = ctx.petName?.trim() ? `（${ctx.petName.trim()}）` : '';
  return [
    '已收到你的預約申請 ✅',
    '',
    `店家：${ctx.merchantName}`,
    `服務：${ctx.serviceName}${pet}`,
    `時間：${whenLine(ctx.startsAt)}`,
    '',
    '店家確認後預約才算成立，請稍候通知。',
  ].join('\n');
}

/** 店家：有新預約 */
export function copyMerchantNewRequest(ctx: BookingNotifyContext): string {
  const who = ctx.customerName?.trim() || '客人';
  const pet = ctx.petName?.trim() ? `／${ctx.petName.trim()}` : '';
  return [
    '有新的預約申請 📬',
    '',
    `客人：${who}${pet}`,
    `服務：${ctx.serviceName}`,
    `時間：${whenLine(ctx.startsAt)}`,
    '',
    '請到店家後台「預約」確認或改期。',
  ].join('\n');
}

/** 顧客：預約已確認 */
export function copyCustomerConfirmed(ctx: BookingNotifyContext): string {
  const pet = ctx.petName?.trim() ? `（${ctx.petName.trim()}）` : '';
  return [
    '預約已確認 🎉',
    '',
    `店家：${ctx.merchantName}`,
    `服務：${ctx.serviceName}${pet}`,
    `時間：${whenLine(ctx.startsAt)}`,
    '',
    '期待到店見！若要改期請直接聯繫店家。',
  ].join('\n');
}

/** 顧客：預約前一天提醒 */
export function copyReminder1d(ctx: BookingNotifyContext): string {
  return [
    '提醒：明天有預約 🗓️',
    '',
    `店家：${ctx.merchantName}`,
    `服務：${ctx.serviceName}`,
    `時間：${whenLine(ctx.startsAt)}`,
  ].join('\n');
}

/** 顧客：預約前兩小時提醒 */
export function copyReminder2h(ctx: BookingNotifyContext): string {
  return [
    '提醒：兩小時後有預約 ⏰',
    '',
    `店家：${ctx.merchantName}`,
    `服務：${ctx.serviceName}`,
    `時間：${whenLine(ctx.startsAt)}`,
    '',
    '請準時到店，路上小心。',
  ].join('\n');
}

/** 顧客：改期並確認 */
export function copyCustomerRescheduled(ctx: BookingNotifyContext): string {
  return [
    '預約時間已更新並確認 ✅',
    '',
    `店家：${ctx.merchantName}`,
    `服務：${ctx.serviceName}`,
    `新時間：${whenLine(ctx.startsAt)}`,
  ].join('\n');
}

/**
 * T−1d：台北日曆「明天」有預約（配合 Hobby 每日 cron，不用 hourly）。
 */
export function isInReminder1dWindow(startsAt: Date, now: Date): boolean {
  const tomorrow = addTaipeiCalendarDays(taipeiDateInput(now), 1);
  return taipeiDateInput(startsAt) === tomorrow;
}

/** T−2h：90～150 分鐘視窗（靠 POS 節流掃描補齊；每日 cron 亦會掃一次） */
export function isInReminder2hWindow(startsAt: Date, now: Date): boolean {
  const ms = startsAt.getTime() - now.getTime();
  return ms >= 90 * 60 * 1000 && ms <= 150 * 60 * 1000;
}
