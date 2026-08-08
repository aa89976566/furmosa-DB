/**
 * 交易通知優先：同一台灣早晨若已有交易推播時間戳 → 早安 SKIPPED。
 *
 * 限制（誠實標示）：
 * - 可查：Appointment 的 lineNotify* / lineReminder* 時間戳（當日台北）
 * - 尚無 pending queue：換罐付款／開箱審核／訂單出貨 push 目前沒有通用已送時間戳
 * - 因此這些管道在 MVP 只能靠未來寫入 MorningDelivery（campaignKey 非 morning）
 *   或擴充各業務時間戳；此處留下 provider interface。
 */

import { prisma } from '@/lib/prisma';
import { taipeiTodayRange } from '@/lib/taipei-date';

export type TransactionalHit = {
  channel: string;
  at: Date;
  detail?: string;
};

export interface TransactionalSignalProvider {
  readonly id: string;
  findSignalsForMorning(
    lineUserId: string,
    taipeiDate: string,
    now?: Date,
  ): Promise<TransactionalHit[]>;
}

/** 預約／提醒：復用既有已送時間戳 */
export class AppointmentTransactionalProvider implements TransactionalSignalProvider {
  readonly id = 'appointment';

  async findSignalsForMorning(
    lineUserId: string,
    _taipeiDate: string,
    now: Date = new Date(),
  ): Promise<TransactionalHit[]> {
    const { start, end } = taipeiTodayRange(now);
    const customer = await prisma.customer.findFirst({
      where: { lineUserId },
      select: { id: true },
    });
    if (!customer) return [];

    const rows = await prisma.appointment.findMany({
      where: {
        customerId: customer.id,
        OR: [
          { lineNotifyReceivedAt: { gte: start, lte: end } },
          { lineNotifyConfirmedAt: { gte: start, lte: end } },
          { lineReminder1dAt: { gte: start, lte: end } },
          { lineReminder2hAt: { gte: start, lte: end } },
        ],
      },
      select: {
        id: true,
        lineNotifyReceivedAt: true,
        lineNotifyConfirmedAt: true,
        lineReminder1dAt: true,
        lineReminder2hAt: true,
      },
      take: 20,
    });

    const hits: TransactionalHit[] = [];
    for (const r of rows) {
      const stamps: Array<[string, Date | null]> = [
        ['appointment.received', r.lineNotifyReceivedAt],
        ['appointment.confirmed', r.lineNotifyConfirmedAt],
        ['appointment.reminder_1d', r.lineReminder1dAt],
        ['appointment.reminder_2h', r.lineReminder2hAt],
      ];
      for (const [channel, at] of stamps) {
        if (at && at >= start && at <= end) {
          hits.push({ channel, at, detail: r.id });
        }
      }
    }
    return hits;
  }
}

/**
 * 通用 MorningDelivery 上非 morning campaign 的當日紀錄
 * （預留給換罐／開箱／出貨未來寫入同一張 delivery 表）
 */
export class DeliveryLogTransactionalProvider implements TransactionalSignalProvider {
  readonly id = 'delivery_log';

  async findSignalsForMorning(
    lineUserId: string,
    taipeiDate: string,
  ): Promise<TransactionalHit[]> {
    const rows = await prisma.lineMorningDelivery.findMany({
      where: {
        lineUserId,
        taipeiDate,
        campaignKey: { not: 'morning' },
        status: { in: ['SENT', 'DRY_RUN'] },
      },
      select: { campaignKey: true, createdAt: true },
      take: 20,
    });
    return rows.map((r) => ({
      channel: `delivery.${r.campaignKey}`,
      at: r.createdAt,
    }));
  }
}

export class CompositeTransactionalProvider implements TransactionalSignalProvider {
  readonly id = 'composite';

  constructor(private readonly providers: TransactionalSignalProvider[]) {}

  async findSignalsForMorning(
    lineUserId: string,
    taipeiDate: string,
    now?: Date,
  ): Promise<TransactionalHit[]> {
    const nested = await Promise.all(
      this.providers.map((p) => p.findSignalsForMorning(lineUserId, taipeiDate, now)),
    );
    return nested.flat();
  }
}

export const defaultTransactionalProvider = new CompositeTransactionalProvider([
  new AppointmentTransactionalProvider(),
  new DeliveryLogTransactionalProvider(),
]);

/**
 * MVP 已知缺口（文件／admin 顯示用）
 */
export const TRANSACTIONAL_COVERAGE_NOTES = [
  '已覆蓋：預約確認／提醒（Appointment lineNotify*／lineReminder* 當日時間戳）。',
  '未覆蓋 pending queue：換罐付款、開箱審核結果、訂單／出貨 LINE push 目前無通用已送時間戳。',
  '後續：各業務送出時寫入 delivery log（campaignKey≠morning）或專屬 *NotifiedAt 欄位。',
] as const;
