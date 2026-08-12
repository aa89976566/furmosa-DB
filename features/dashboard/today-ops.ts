import { prisma } from '@/lib/prisma';
import { RESTOCK_APPROVABLE_STATUSES } from '@/lib/restock-request/constants';

export type HqTodayOpsRow = {
  id: string;
  title: string;
  description: string;
  count: number;
  href: string;
  /** Highlight when count > 0 */
  urgency: 'action' | 'watch' | 'done';
};

export type HqTodayOpsResult = {
  rows: HqTodayOpsRow[];
  loadedAt: string;
  warnings: string[];
};

function startOfTodayTaipei(): Date {
  // Align with existing dashboard KPI Taipei day boundary (UTC+8)
  const now = new Date();
  const taipeiMs = now.getTime() + 8 * 60 * 60 * 1000;
  const day = new Date(taipeiMs);
  day.setUTCHours(0, 0, 0, 0);
  return new Date(day.getTime() - 8 * 60 * 60 * 1000);
}

async function safeCount(
  label: string,
  fn: () => Promise<number>,
  warnings: string[],
): Promise<number> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[hq-today-ops] ${label}`, err);
    warnings.push(label);
    return 0;
  }
}

/**
 * HQ「今天營運」佇列計數 — Experience Bible H-02。
 * 每個數字都對應可點進的任務列表；查詢失敗不炸整頁。
 */
export async function getHqTodayOps(): Promise<HqTodayOpsResult> {
  const warnings: string[] = [];
  const todayStart = startOfTodayTaipei();

  const [
    restockPending,
    shipmentsPending,
    appointmentsPending,
    refillPaymentIssues,
    jibaPending,
    restockDoneToday,
    shipmentsShippedToday,
  ] = await Promise.all([
    safeCount(
      'restock',
      () =>
        prisma.restockRequest.count({
          where: { status: { in: [...RESTOCK_APPROVABLE_STATUSES] } },
        }),
      warnings,
    ),
    safeCount(
      'shipments',
      () =>
        prisma.shipment.count({
          where: { status: { in: ['pending', 'packed'] } },
        }),
      warnings,
    ),
    safeCount(
      'appointments',
      () =>
        prisma.appointment.count({
          where: { status: { in: ['requested', 'reschedule_proposed'] } },
        }),
      warnings,
    ),
    safeCount(
      'refill-payment',
      () =>
        prisma.refillOrder.count({
          where: {
            status: {
              in: ['payment_pending', 'payment_failed', 'awaiting_extra_payment'],
            },
          },
        }),
      warnings,
    ),
    safeCount(
      'jiba',
      () =>
        prisma.campaignApplication.count({
          where: { status: 'PENDING_REVIEW' },
        }),
      warnings,
    ),
    safeCount(
      'restock-done',
      () =>
        prisma.restockRequest.count({
          where: {
            status: 'converted_to_shipment',
            approvedAt: { gte: todayStart },
          },
        }),
      warnings,
    ),
    safeCount(
      'shipped-today',
      () =>
        prisma.shipment.count({
          where: {
            status: { in: ['shipped', 'delivered'] },
            OR: [
              { shippedAt: { gte: todayStart } },
              { deliveredAt: { gte: todayStart } },
            ],
          },
        }),
      warnings,
    ),
  ]);

  const doneToday = restockDoneToday + shipmentsShippedToday;

  const rows: HqTodayOpsRow[] = [
    {
      id: 'restock',
      title: '待審叫貨',
      description: '店家 POS 送來的補貨，待核准或轉出貨',
      count: restockPending,
      href: '/restock-requests',
      urgency: restockPending > 0 ? 'action' : 'done',
    },
    {
      id: 'shipments',
      title: '待寄出',
      description: '出貨佇列（待處理／已打包）',
      count: shipmentsPending,
      href: '/shipments?status=pending',
      urgency: shipmentsPending > 0 ? 'action' : 'done',
    },
    {
      id: 'appointments',
      title: '預約待處理',
      description: '待店家／總部確認或改期中的預約',
      count: appointmentsPending,
      href: '/merchants',
      urgency: appointmentsPending > 0 ? 'watch' : 'done',
    },
    {
      id: 'refill-payment',
      title: '換罐付款異常',
      description: '待付款、付款失敗、或待補差額',
      count: refillPaymentIssues,
      href: '/jar-exchange/manage?tab=codes',
      urgency: refillPaymentIssues > 0 ? 'action' : 'done',
    },
    {
      id: 'jiba',
      title: '雞霸開箱待審',
      description: 'LINE 開箱活動待壽司匠審核',
      count: jibaPending,
      href: '/campaigns/jiba-two-piece',
      urgency: jibaPending > 0 ? 'watch' : 'done',
    },
    {
      id: 'done-today',
      title: '今日已完成',
      description: '今天已轉出貨的叫貨 + 已寄／已送達',
      count: doneToday,
      href: '/shipments?status=shipped',
      urgency: 'done',
    },
  ];

  return {
    rows,
    loadedAt: new Date().toISOString(),
    warnings,
  };
}
