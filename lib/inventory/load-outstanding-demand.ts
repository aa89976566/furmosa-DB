import type { PrismaClient } from '@prisma/client';
import { outstandingDemand } from './outstanding-demand';

/** Bounded, read-only HQ order/shipment demand snapshot; no reservations are written. */
export async function loadOutstandingDemand(db: Pick<PrismaClient, '$transaction'>) {
  return db.$transaction(async tx => {
    const items = { select: { quantity: true, weightGrams: true, variantKey: true,
      product: { select: { id: true, sku: true, unit: true, category: true, inventorySourceProductId: true,
        priceTiers: { select: { id: true, weightGrams: true, unit: true, unitQty: true,
          bundleComponents: { select: { componentProductId: true, gramsPerPack: true } } } } } } } } as const;
    const orders = await tx.order.findMany({ where: { status: { not: 'cancelled' }, paymentStatus: { not: 'refunded' },
      fulfillmentStatus: { in: ['pending', 'packed'] } },
      select: { id: true, externalOrderId: true, omsIssueFlags: true, items, shipments: { select: { id: true } } }, orderBy: { id: 'asc' }, take: 1001 });
    // Linked shipments are already represented by their parent order; do not reserve twice.
    const standalone = await tx.shipment.findMany({ where: { orderId: null, status: { in: ['pending', 'packed'] } },
      select: { id: true, items }, orderBy: { id: 'asc' }, take: 1001 });
    const groups = [...orders.map(o => ({ id: `order:${o.id}`, items: o.items,
      references: [`order:${o.id}`, ...o.shipments.map(s => `shipment:${s.id}`)] })),
      ...standalone.map(s => ({ id: `shipment:${s.id}`, items: s.items, references: [`shipment:${s.id}`] }))];
    const postings = await tx.inventoryTransaction.findMany({ where: { type: 'sales_out', eventKey: { not: null },
      reference: { in: groups.flatMap(g => g.references) }, warehouse: { code: 'WH-MAIN' } },
      select: { reference: true, productId: true, quantity: true, reversal: { select: { quantity: true } } } });
    const result = outstandingDemand(groups, postings);
    const unresolved = orders.some(o => o.externalOrderId && (!Array.isArray(o.omsIssueFlags) ||
      o.omsIssueFlags.some(flag => typeof flag === 'object' && flag !== null && 'blocking' in flag && flag.blocking === true)));
    return { ...result, complete: result.complete && !unresolved && orders.length <= 1000 && standalone.length <= 1000 };
  }, { isolationLevel: 'RepeatableRead', maxWait: 3000, timeout: 15000 });
}
