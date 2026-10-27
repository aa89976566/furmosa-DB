import { prisma } from '@/lib/prisma';
import { bulkUnit } from './bulk';
import { buildReorderAlertSummary } from './reorder-alerts';
import { incomingHqGrams, missingShipmentDeductions, outstandingPurchaseLines } from './dashboard-procurement';
import { INVENTORY_LOW_STOCK_THRESHOLD } from '@/lib/pos/inventory-groups';

export async function loadDashboardProcurement() {
  const auditSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const receiptSelect = { id: true, purchaseOrderId: true, items: { select: { productId: true, quantityGrams: true, sourceOrderItemId: true } } } as const;
  const [products, purchases, merchantStocks, merchantStockCount, shipments] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'active', productCategory: 'STANDARD', category: { in: ['staple_food', 'treats', 'freeze_dried', 'health'] } },
      select: { id: true, name: true, sku: true, unit: true, reorderPoint: true, vendor: { select: { name: true } },
        inventoryBalances: { where: { warehouse: { code: 'WH-MAIN' } }, select: { quantity: true, unit: true, lastCountedAt: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    prisma.purchaseOrder.findMany({
      where: { status: 'pending_receipt' },
      select: { id: true, orderNumber: true, remindFromDate: true, vendor: { select: { name: true } }, warehouse: { select: { code: true, name: true } },
        items: { select: { id: true, productId: true, productName: true, quantityGrams: true, unit: true }, orderBy: { lineNumber: 'asc' } },
        receipt: { select: receiptSelect }, receipts: { select: receiptSelect } },
      orderBy: [{ remindFromDate: 'asc' }, { id: 'asc' }],
    }),
    prisma.merchantStock.findMany({
      where: { quantity: { lte: INVENTORY_LOW_STOCK_THRESHOLD }, merchant: { status: 'active' }, product: { status: 'active' } },
      select: { id: true, merchantId: true, tierId: true, quantity: true, merchant: { select: { name: true } },
        product: { select: { name: true, priceTiers: { select: { id: true, weightGrams: true, unitQty: true, unit: true } } } } },
      orderBy: [{ quantity: 'asc' }, { id: 'asc' }], take: 50,
    }),
    prisma.merchantStock.count({ where: { quantity: { lte: INVENTORY_LOW_STOCK_THRESHOLD }, merchant: { status: 'active' }, product: { status: 'active' } } }),
    prisma.shipment.findMany({
      where: { hqInventoryEligible: true, status: { in: ['shipped', 'delivered', 'received'] }, shippedAt: { gte: auditSince } },
      select: { id: true, shipmentNumber: true, hqInventoryEligible: true, status: true,
        order: { select: { status: true, fulfillmentStatus: true, paymentStatus: true } },
        items: { select: { productId: true, productName: true, quantity: true, product: { select: { sku: true, category: true } } } } },
      orderBy: [{ shippedAt: 'desc' }, { id: 'desc' }], take: 100,
    }),
  ]);
  const incoming = incomingHqGrams(purchases);
  const reorderAlerts = buildReorderAlertSummary(products.map(product => {
    const balance = product.inventoryBalances[0];
    const unit = bulkUnit(balance?.unit);
    return { id: product.id, name: product.name, sku: product.sku, reorderPoint: product.reorderPoint,
      vendorName: product.vendor?.name ?? null, onHand: balance?.quantity ?? 0, unit,
      unitVerified: Boolean(unit && unit === bulkUnit(product.unit)), lastCountedAt: balance?.lastCountedAt ?? null,
      incoming: unit === 'g' ? incoming.get(product.id) ?? 0 : 0 };
  }));
  const ledger = shipments.length ? await prisma.inventoryTransaction.findMany({
    where: { type: 'sales_out', reference: { in: shipments.map(row => `shipment:${row.id}`) }, warehouse: { code: 'WH-MAIN' }, eventKey: { not: null } },
    select: { reference: true, productId: true, quantity: true, eventKey: true },
  }) : [];
  return { reorderAlerts,
    purchases: purchases.map(order => ({ ...order, remainingLines: outstandingPurchaseLines(order) })),
    merchantStocks, merchantStockCount, merchantLowThreshold: INVENTORY_LOW_STOCK_THRESHOLD,
    shipmentAudit: { checked: shipments.length, limit: 100, days: 30, missing: missingShipmentDeductions(shipments, ledger) },
  };
}

export type DashboardProcurementData = Awaited<ReturnType<typeof loadDashboardProcurement>>;
