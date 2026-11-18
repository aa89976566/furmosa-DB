import { prisma } from '@/lib/prisma';
import { MADE_TO_ORDER_HQ_SKUS } from './shipment-advisory';
import { madeToOrderDemand } from './made-to-order';

export async function loadMadeToOrderDemand() {
  const items = { select: { productId: true, productName: true, quantity: true, weightGrams: true, variantKey: true,
    product: { select: { sku: true, unit: true, priceTiers: { select: { id: true, weightGrams: true, unit: true, unitQty: true } } } } } } as const;
  const orders = await prisma.order.findMany({ where: { deletedAt: null, status: { not: 'cancelled' },
    paymentStatus: { not: 'refunded' }, fulfillmentStatus: { in: ['pending', 'packed'] },
    items: { some: { product: { sku: { in: [...MADE_TO_ORDER_HQ_SKUS] } } } } },
    select: { id: true, orderNumber: true, status: true, paymentStatus: true, fulfillmentStatus: true,
      omsStatus: true, deletedAt: true, items,
      shipments: { select: { status: true, items } } },
    orderBy: [{ orderedAt: 'asc' }, { id: 'asc' }], take: 501 });
  return madeToOrderDemand(orders.slice(0, 500), orders.length > 500);
}
