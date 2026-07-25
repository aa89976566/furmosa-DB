import { prisma } from '@/lib/prisma';
import { pushLineText } from '@/lib/line/push';
import {
  copyReminder1d,
  copyReminder2h,
  isInReminder1dWindow,
  isInReminder2hWindow,
} from '@/lib/booking/notify-copy';
import { addTaipeiCalendarDays, taipeiDateInput } from '@/lib/taipei-date';

export type ReminderRunResult = {
  checked: number;
  reminder1d: number;
  reminder2h: number;
  skippedNoLine: number;
  errors: number;
};

/**
 * 掃描已確認預約，送出 T−1d／T−2h 提醒（冪等）。
 * - 每日 cron：主要負責「明天」1d
 * - POS 節流掃描：補 T−2h（Hobby 不可 hourly cron）
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

  const today = taipeiDateInput(now);
  const dayAfterTomorrow = addTaipeiCalendarDays(today, 2);
  const from = now;
  const to = new Date(`${dayAfterTomorrow}T23:59:59.999+08:00`);

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
