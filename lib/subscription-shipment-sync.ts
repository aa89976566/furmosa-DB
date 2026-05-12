import { prisma } from '@/lib/prisma';

const DEFAULT_DAYS_AHEAD = 7;

// 把「一週內要寄出」的訂閱排程同步成 Shipment(pending)，
// 讓物流人員在 /shipments 隊列就能看到。
//
// 規則：
// - 找出 scheduledDate <= now + daysAhead，且 status 還沒寄出 (pending/preparing/packed) 的 SubscriptionShipment
// - 若該排程還沒掛 Shipment（透過 subscriptionShipmentId 唯一），就建一張 type=subscription / status=pending 的 Shipment
// - 不會重複建單；安全可重跑
export async function syncUpcomingSubscriptionShipments(
  daysAhead = DEFAULT_DAYS_AHEAD,
): Promise<{ created: number; checked: number }> {
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

  const upcoming = await prisma.subscriptionShipment.findMany({
    where: {
      scheduledDate: { lte: cutoff },
      status: { in: ['pending', 'planned', 'preparing', 'packed'] },
      shipment: null, // 還沒掛 Shipment
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
      // 唯一鍵衝突就忽略（同個排程可能在另一個 request 也建了）
      if ((e as { code?: string })?.code !== 'P2002') throw e;
    }
  }

  return { created, checked: upcoming.length };
}

// 解析 SubscriptionPlan.contents JSON 成可顯示的列表
export type PlanContentItem = { name: string; weight?: string; note?: string };

export function parsePlanContents(raw: string | null | undefined): PlanContentItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is PlanContentItem => typeof x?.name === 'string');
  } catch {
    return [];
  }
}

export function formatPlanContents(items: PlanContentItem[]): string {
  return items.map((c) => (c.weight ? `${c.name}（${c.weight}）` : c.name)).join('、');
}
