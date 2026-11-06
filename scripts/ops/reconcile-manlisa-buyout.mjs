// Explicitly approved 2026-11-06 ownership correction. Dry-run by default.
// Run only AFTER the ownership migration and matching application are deployed.
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const apply = process.argv.includes('--apply');
const merchantId = 'cmpvi43w8girg2lr4o';
const productId = 'cmvntyis40001hxvl3fqiiez8';
const stockId = 'cmw0pnklt000bwbj2i7uahp62';
const giftOrderId = 'cmvp1i1ea00056unb0atv6z3q';
const mixedOrderId = 'cmvui5tsl000j12qqyni272vi';
const buyoutOrderId = 'mls-buyout-20261106';
const auditId = 'audit-mls-buyout-20261106';

async function reconcile(tx, write) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('manlisa-buyout-20261106',0))`;
  const prior = await tx.statusAuditLog.findUnique({ where: { id: auditId } });
  if (prior) return { alreadyApplied: true, auditId };
  const stock = await tx.merchantStock.findUniqueOrThrow({ where: { id: stockId }, include: { lots: true } });
  const [gift, mixed, recentSales] = await Promise.all([
    tx.order.findUniqueOrThrow({ where: { id: giftOrderId }, include: { items: true } }),
    tx.order.findUniqueOrThrow({ where: { id: mixedOrderId }, include: { items: true } }),
    tx.merchantStockTxn.count({ where: { merchantId, productId, type: 'sale' } }),
  ]);
  const giftItem = gift.items.find(i => i.id === 'cmvqq2a3w002yc2liaiqn1mqh');
  const soldItem = mixed.items.find(i => i.id === 'cmvy41mbe0002ln7qycv73x3e');
  if (stock.merchantId !== merchantId || stock.productId !== productId || stock.quantity !== 20 || stock.lots.length || recentSales ||
    gift.merchantId !== merchantId || mixed.merchantId !== merchantId ||
    !giftItem || giftItem.quantity !== 15 || !giftItem.isGift || giftItem.subtotal !== 0 ||
    !soldItem || soldItem.quantity !== 5 || soldItem.isGift || soldItem.unitPrice !== 165 || soldItem.subtotal !== 825 ||
    gift.merchantOrderMode !== 'consignment' || mixed.merchantOrderMode !== 'consignment') {
    throw new Error('STOP: exact approved stock/order preconditions changed; do not guess or re-import stock');
  }
  const summary = { merchantId, stock: 20, sponsored: 15, buyoutPriced: 5, inheritedReferenceUnitPrice: soldItem.unitPrice,
    inheritedReferenceTotal: soldItem.subtotal, paymentVerified: false, action: write ? 'apply' : 'dry-run' };
  if (!write) return summary;
  await tx.order.create({ data: {
    id: buyoutOrderId, orderNumber: 'MLS-BUYOUT-20261106', merchantId,
    source: 'wholesale', merchantOrderMode: 'wholesale', status: 'completed', fulfillmentStatus: 'delivered',
    paymentStatus: 'unpaid', subtotal: soldItem.subtotal, total: soldItem.subtotal,
    orderedAt: mixed.orderedAt, shippedAt: mixed.shippedAt, completedAt: new Date(),
    hqInventoryEligible: false,
    note: '既有實收黃金條5包轉買斷；非新出貨，不得再次扣HQ或店家庫存。單價165沿用原訂單參考值，買斷成交價及收款尚未核實；不得作為已收款。原出貨SHP-202610-0026。',
  } });
  await tx.orderItem.update({ where: { id: soldItem.id }, data: { orderId: buyoutOrderId } });
  await tx.order.update({ where: { id: giftOrderId }, data: {
    source: 'wholesale', merchantOrderMode: 'wholesale',
    note: `${gift.note ?? ''}\n15包零元贊助，庫存歸店家所有，售出不列寄賣月結；原運費及付款狀態保留。`,
  } });
  await tx.order.update({ where: { id: mixedOrderId }, data: {
    // Consignment restock items retain their reference prices, but are not a purchase invoice.
    subtotal: 0, total: mixed.shippingFee - mixed.discount,
    note: `${mixed.note ?? ''}\n黃金條5包已移至MLS-BUYOUT-20261106買斷訂單，其餘為寄賣補貨，商品價款不在補貨時請款。全部貨已收，禁止再次入庫。`,
  } });
  await tx.merchantStockLot.createMany({ data: [
    { id: 'mls-buyout-gift-20261106', stockId, sourceKey: 'shipment-item:cmvqq2bp60030c2lifcfrtbm7', mode: 'wholesale',
      initialQuantity: 15, remainingQuantity: 15, gift: true, acquiredAt: new Date('2026-11-03T13:15:32.947Z'), note: `原15包贊助，來源訂單${giftOrderId}` },
    { id: 'mls-buyout-priced-20261106', stockId, sourceKey: 'shipment-item:cmvy41nxr0008ln7q40spxp1o', mode: 'wholesale',
      initialQuantity: 5, remainingQuantity: 5, gift: false, acquiredAt: new Date('2026-11-05T23:44:26.274Z'), note: `5包買斷，來源訂單${buyoutOrderId}；不新增實物庫存` },
  ] });
  await tx.statusAuditLog.create({ data: {
    id: auditId, entityType: 'merchant', entityId: merchantId, actorType: 'system',
    previousStatus: 'consignment_stock', newStatus: 'wholesale_stock',
    metadataJson: JSON.stringify({ authorization: 'user approved batch ownership correction', before: { stock, gift, mixed }, after: summary }),
  } });
  const after = await tx.merchantStock.findUniqueOrThrow({ where: { id: stockId }, include: { lots: true } });
  if (after.quantity !== 20 || after.lots.reduce((n,l) => n+l.remainingQuantity,0) !== 20) throw new Error('Postcondition failed');
  return summary;
}
try {
  console.log(JSON.stringify(await db.$transaction(tx => reconcile(tx, apply), { isolationLevel: 'Serializable', timeout: 30000 })));
} finally { await db.$disconnect(); }
