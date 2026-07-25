import { prisma } from '@/lib/prisma';
import { pushLineText } from '@/lib/line/push';
import {
  copyReminder1d,
  copyReminder2h,
  isInReminder1dWindow,
  isInReminder2hWindow,
} from '@/lib/booking/notify-copy';

export type ReminderRunResult = {
  checked: number;
  reminder1d: number;
  reminder2h: number;
  skippedNoLine: number;
  errors: number;
};

/**
 * 掃描已確認預約，送出 T−1d／T−2h 提醒（冪等）。
 * 供 hourly cron 呼叫；無 LINE 收件人亦標記已處理。
 */
export async function processAppointmentReminders(
  now: Date = new Date(),
): Promise<ReminderRunResult> {
  const result: ReminderRunResult = {
    checked: 0,
    reminder1d: 0,
    reminder2h: 0,
    skippedNoLine: 0,
    errors: 0,
  };

  // 最遠看 T−26h；最近看即將開始（2h 窗下限 90m，仍載入到 +26h）
  const from = new Date(now.getTime() + 60 * 60 * 1000);
  const to = new Date(now.getTime() + 26 * 60 * 60 * 1000);

  const rows = await prisma.appointment.findMany({
    where: {
      status: 'confirmed',
      startsAt: { gte: from, lte: to },
      OR: [{ lineReminder1dAt: null }, { lineReminder2hAt: null }],
    },
    select: {
      id: true,
      startsAt: true,
      serviceName: true,
      petName: true,
      lineReminder1dAt: true,
      lineReminder2hAt: true,
      customer: { select: { lineUserId: true } },
      merchant: { select: { name: true } },
    },
    take: 200,
  });

  result.checked = rows.length;

  for (const row of rows) {
    const ctx = {
      merchantName: row.merchant.name,
      serviceName: row.serviceName,
      startsAt: row.startsAt,
      petName: row.petName,
    };
    const lineUserId = row.customer.lineUserId;

    if (!row.lineReminder1dAt && isInReminder1dWindow(row.startsAt, now)) {
      if (lineUserId) {
        const r = await pushLineText(lineUserId, copyReminder1d(ctx));
        if (!r.ok && !r.skipped) {
          console.error('[booking/reminders] 1d', row.id, r.error);
          result.errors += 1;
        } else {
          await prisma.appointment.update({
            where: { id: row.id },
            data: { lineReminder1dAt: now },
          });
          result.reminder1d += 1;
        }
      } else {
        await prisma.appointment.update({
          where: { id: row.id },
          data: { lineReminder1dAt: now },
        });
        result.skippedNoLine += 1;
      }
    }

    if (!row.lineReminder2hAt && isInReminder2hWindow(row.startsAt, now)) {
      if (lineUserId) {
        const r = await pushLineText(lineUserId, copyReminder2h(ctx));
        if (!r.ok && !r.skipped) {
          console.error('[booking/reminders] 2h', row.id, r.error);
          result.errors += 1;
        } else {
          await prisma.appointment.update({
            where: { id: row.id },
            data: { lineReminder2hAt: now },
          });
          result.reminder2h += 1;
        }
      } else {
        await prisma.appointment.update({
          where: { id: row.id },
          data: { lineReminder2hAt: now },
        });
        result.skippedNoLine += 1;
      }
    }
  }

  return result;
}
