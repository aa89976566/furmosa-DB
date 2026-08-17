import { prisma } from '@/lib/prisma';
import {
  CUSTOMER_ORDER_SOURCES,
  planCustomerShippingRepair,
  type CustomerShippingRepairPlan,
} from '@/lib/orders/normalize-shipping-address';

export type CustomerShippingRepairItem = {
  orderId: string;
  action: CustomerShippingRepairPlan['action'];
  reason?: string;
  extracted?: string[];
};

export type CustomerShippingRepairResult = {
  dryRun: boolean;
  scanned: number;
  repairable: number;
  repaired: number;
  skipped: number;
  noop: number;
  skippedReasons: Record<string, number>;
  items: CustomerShippingRepairItem[];
};

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

export async function repairCustomerShipping(opts?: {
  dryRun?: boolean;
}): Promise<CustomerShippingRepairResult> {
  const dryRun = opts?.dryRun !== false;
  const orders = await prisma.order.findMany({
    where: {
      source: { in: [...CUSTOMER_ORDER_SOURCES] },
      shippingAddress: { not: null },
    },
    select: {
      id: true,
      source: true,
      note: true,
      shippingAddress: true,
      shippingMethod: true,
      cvsBrand: true,
      cvsStoreId: true,
      cvsStoreName: true,
      shipments: {
        where: { type: 'customer_order' },
        select: {
          id: true,
          recipientName: true,
          recipientPhone: true,
          recipientAddress: true,
        },
      },
    },
  });

  const skippedReasons: Record<string, number> = {};
  const items: CustomerShippingRepairItem[] = [];
  let repairable = 0;
  let repaired = 0;
  let skipped = 0;
  let noop = 0;

  for (const order of orders) {
    const plan = planCustomerShippingRepair({
      source: order.source,
      note: order.note,
      shippingAddress: order.shippingAddress,
      shippingMethod: order.shippingMethod,
      cvsBrand: order.cvsBrand,
      cvsStoreId: order.cvsStoreId,
      cvsStoreName: order.cvsStoreName,
      shipments: order.shipments,
    });

    if (plan.action === 'skip') {
      skipped += 1;
      bump(skippedReasons, plan.reason);
      items.push({ orderId: order.id, action: 'skip', reason: plan.reason });
      continue;
    }
    if (plan.action === 'noop') {
      noop += 1;
      items.push({ orderId: order.id, action: 'noop', reason: plan.reason });
      continue;
    }

    repairable += 1;
    items.push({
      orderId: order.id,
      action: 'repair',
      extracted: plan.extracted,
    });

    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: plan.orderPatch,
      });
      for (const patch of plan.shipmentPatches) {
        const { shipmentId, ...data } = patch;
        await tx.shipment.update({
          where: { id: shipmentId },
          data,
        });
      }
    });
    repaired += 1;
  }

  return {
    dryRun,
    scanned: orders.length,
    repairable,
    repaired: dryRun ? 0 : repaired,
    skipped,
    noop,
    skippedReasons,
    items,
  };
}

export function summarizeRepairResult(result: CustomerShippingRepairResult) {
  return {
    dryRun: result.dryRun,
    scanned: result.scanned,
    repairable: result.repairable,
    repaired: result.repaired,
    skipped: result.skipped,
    noop: result.noop,
    skippedReasons: result.skippedReasons,
    items: result.items.map((item) => ({
      orderId: item.orderId,
      action: item.action,
      reason: item.reason,
      extracted: item.extracted,
    })),
  };
}

