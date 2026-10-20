'use server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { snapshotHash, record, string, type Snapshot } from '@/lib/shopify/intake-policy';
import { toTierCatalog } from '@/lib/shopify/match-line-item';
import { matchShopifyLineToTier } from '@/lib/shopify/match-product-tier';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/** Append only verified missing purchase lines to a single unshipped OMS shipment. */
export async function repairShopifyShipment(form: FormData): Promise<void> {
  const session = await getCurrentUser();
  const orderId = String(form.get('orderId') ?? '');
  const sourceHash = String(form.get('sourceHash') ?? '');
  let message = '';
  try {
    if (!session) throw new Error('請先登入 HQ');
    message = await prisma.$transaction(async tx => {
      const actor = await tx.user.findUnique({ where: { id: session.userId } });
      if (!actor || !['admin', 'staff'].includes(actor.role)) throw new Error('需要 HQ 審核權限');
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
      const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true, shipments: { include: { items: true } } } });
      if (!order || order.deletedAt || order.archivedAt || order.omsStatus !== 'FULFILLMENT_PENDING' || order.status !== 'confirmed') throw new Error('僅能補齊尚未出貨的 Shopify 訂單');
      const snapshot = order.shopifySnapshot as Snapshot;
      if (!snapshot || snapshotHash(snapshot) !== sourceHash) throw new Error('來源內容已更新，請重新整理');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'shopify:' + order.externalStore + ':' + order.externalOrderId}, 0))`;
      const live = order.shipments.filter(s => s.status !== 'cancelled');
      if (live.length !== 1 || live[0].status !== 'pending' || live[0].shipmentNumber !== 'OMS-' + order.id) throw new Error('出貨單已處理或有多張，請人工核對');
      const shipment = live[0];
      await tx.$queryRaw`SELECT id FROM "Shipment" WHERE id = ${shipment.id} FOR UPDATE`;
      const fresh = await tx.shipment.findUniqueOrThrow({ where: { id: shipment.id } });
      if (fresh.status !== 'pending') throw new Error('出貨狀態已變更');
      const products = await tx.product.findMany({ where: { status: 'active' }, include: { priceTiers: true } });
      const catalog = toTierCatalog(products);
      const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items.map(record) : [];
      if (!rows.length) throw new Error('來源沒有品項');
      const expected = new Map<string, { productId: string; productName: string; sku: string; quantity: number; weightGrams: number | null; variantKey: string; unit: string; notes: string | null; unitPrice: number }>();
      for (const row of rows) {
        const decision = matchShopifyLineToTier({ variant_id: row.variant_id, sku: string(row.sku), title: string(row.title) }, catalog);
        if (decision.outcome !== 'match') throw new Error('尚未唯一對應商品：' + string(row.title) + '，請先設定規格綁定');
        const product = products.find(p => p.id === decision.productId)!;
        const tier = decision.tier;
        const quantity = row.quantity;
        if (typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 2147483647 || !/^\d+(?:\.\d{1,2})?$/.test(string(row.price))) throw new Error('來源數量或金額無效');
        const key = product.id + ':' + (tier.weightGrams ?? 'count');
        const previous = expected.get(key);
        if (previous && previous.variantKey !== tier.id) throw new Error('同商品有多種數量規格，需人工核對');
        expected.set(key, { productId: product.id, productName: product.name, sku: product.sku, quantity: (previous?.quantity ?? 0) + quantity, weightGrams: tier.weightGrams, variantKey: tier.id, unit: tier.weightGrams ? '包' : tier.unitQty > 1 ? '組' : tier.unit, notes: [tier.notes, tier.unitQty > 1 ? '每組 ' + tier.unitQty + tier.unit : ''].filter(Boolean).join('；') || null, unitPrice: Number(row.price) });
      }
      let added = 0;
      for (const item of expected.values()) {
        const same = (line: { productId: string; weightGrams: number | null }) => line.productId === item.productId && line.weightGrams === item.weightGrams;
        const shipmentQty = shipment.items.filter(same).reduce((n, line) => n + line.quantity, 0);
        const orderQty = order.items.filter(line => !line.isGift && same(line)).reduce((n, line) => n + line.quantity, 0);
        if (shipmentQty > item.quantity || orderQty > item.quantity) throw new Error('既有數量超過來源，需人工核對');
        if (shipment.items.filter(same).some(line => line.variantKey && line.variantKey !== item.variantKey) || order.items.filter(line => !line.isGift && same(line)).some(line => line.variantKey && line.variantKey !== item.variantKey)) throw new Error('既有規格與來源不同，需人工核對');
        await tx.shipmentItem.updateMany({ where: { shipmentId: shipment.id, productId: item.productId, weightGrams: item.weightGrams }, data: { variantKey: item.variantKey, unit: item.unit, ...(item.notes ? { notes: item.notes } : {}) } });
        await tx.orderItem.updateMany({ where: { orderId: order.id, productId: item.productId, weightGrams: item.weightGrams, isGift: false }, data: { variantKey: item.variantKey, unit: item.unit } });

        if (shipmentQty < item.quantity) {
          const { unitPrice: _unitPrice, ...data } = item;
          await tx.shipmentItem.create({ data: { ...data, quantity: item.quantity - shipmentQty, shipmentId: shipment.id } });
          added += item.quantity - shipmentQty;
        }
        if (orderQty < item.quantity) {
          const { notes: _notes, ...data } = item;
          const quantity = item.quantity - orderQty;
          await tx.orderItem.create({ data: { ...data, quantity, subtotal: Math.round(item.unitPrice * 100) * quantity / 100, isGift: item.unitPrice === 0, orderId: order.id } });
        }
      }
      await tx.statusAuditLog.create({ data: { entityType: 'order', entityId: order.id, previousStatus: order.omsStatus, newStatus: order.omsStatus, actorType: 'user', actorId: actor.id, metadataJson: JSON.stringify({ action: 'repair_missing_shopify_lines', sourceHash, shipmentId: shipment.id, addedQuantity: added }) } });
      return added ? '已補齊出貨品項，共補入 ' + added + ' 件' : '出貨品項已齊全';
    }, { timeout: 15000 });
  } catch (error) {
    message = error instanceof Error ? error.message : '補齊未完成';
  }
  revalidatePath('/orders/' + orderId);
  revalidatePath('/shipments');
  redirect('/orders/' + encodeURIComponent(orderId) + '?repair=' + encodeURIComponent(message));
}
