import { prisma } from '@/lib/prisma';
import {
  PENDING_SUBSCRIPTION_SHIPMENT_STATUSES,
} from '@/lib/subscription-shipment-status';
import {
  formatPlanContents,
  parsePlanContents,
  type PlanContentItem,
} from '@/lib/plan-contents';
import { DEFAULT_JOB_TTL_MS, runThrottled } from '@/lib/job-throttle';

export { formatPlanContents, parsePlanContents, type PlanContentItem };

const DEFAULT_DAYS_AHEAD = 28;
const SYNC_JOB_KEY = 'syncUpcomingSubscriptionShipments';

// 把「近期要寄出」與「逾期未寄」的訂閱排程同步成 Shipment(pending)，
// 讓物流人員在 /shipments 隊列就能看到。
//
// 規則：
// - 找出 scheduledDate <= now + daysAhead 且仍待出貨的 SubscriptionShipment
// - 若該排程還沒掛 Shipment（透過 subscriptionShipmentId 唯一），就建一張 type=subscription / status=pending
// - 不會重複建單；安全可重跑
export async function syncUpcomingSubscriptionShipments(
  daysAhead = DEFAULT_DAYS_AHEAD,
): Promise<{ created: number; checked: number }> {
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

  const upcoming = await prisma.subscriptionShipment.findMany({
    where: {
      scheduledDate: { lte: cutoff },
      status: { in: [...PENDING_SUBSCRIPTION_SHIPMENT_STATUSES] },
      shipment: null,
      subscription: { status: 'active' },
    },
    include: {
      subscription: {
        select: {
          customerId: true,
          recipientName: true,
          recipientPhone: true,
          shippingAddress: true,
        },
      },
    },
  });

  if (upcoming.length === 0) {
    return { created: 0, checked: 0 };
  }

  try {
    const result = await prisma.shipment.createMany({
      data: upcoming.map((s) => ({
        shipmentNumber: `SHP-SUB-${s.shipmentNo}`,
        type: 'subscription' as const,
        status: 'pending' as const,
        customerId: s.subscription.customerId,
        subscriptionShipmentId: s.id,
        recipientName: s.subscription.recipientName,
        recipientPhone: s.subscription.recipientPhone,
        recipientAddress: s.subscription.shippingAddress,
        notes: s.notes ?? undefined,
        createdAt: s.scheduledDate,
      })),
      skipDuplicates: true,
    });
    return { created: result.count, checked: upcoming.length };
  } catch {
    // Fallback：逐筆建立（相容舊環境）
    let created = 0;
    for (const s of upcoming) {
      try {
        await prisma.shipment.create({
          data: {
            shipmentNumber: `SHP-SUB-${s.shipmentNo}`,
            type: 'subscription',
            status: 'pending',
            customerId: s.subscription.customerId,
            subscriptionShipmentId: s.id,
            recipientName: s.subscription.recipientName,
            recipientPhone: s.subscription.recipientPhone,
            recipientAddress: s.subscription.shippingAddress,
            notes: s.notes ?? undefined,
            createdAt: s.scheduledDate,
          },
        });
        created++;
      } catch (e) {
        if ((e as { code?: string })?.code !== 'P2002') throw e;
      }
    }
    return { created, checked: upcoming.length };
  }
}

/** 讀頁用：TTL 內略過，避免出貨列隊每次掃描訂閱排程 */
export async function maybeSyncUpcomingSubscriptionShipments(
  daysAhead = DEFAULT_DAYS_AHEAD,
  ttlMs = DEFAULT_JOB_TTL_MS,
): Promise<{ ran: boolean; created: number; checked: number }> {
  const outcome = await runThrottled(
    SYNC_JOB_KEY,
    () => syncUpcomingSubscriptionShipments(daysAhead),
    ttlMs,
  );
  if (!outcome.ran) return { ran: false, created: 0, checked: 0 };
  return { ran: true, ...outcome.result };
}
