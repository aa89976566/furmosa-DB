import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

// One verified SKU first; other products require their own allocation/recipe contract.
export const SALMON_STOCK = {
  productId: 'food-salmon-skin-20261106', tierId: 'food-salmon-skin-20261106-tier',
  sku: 'FUR-SALMON-SKIN-50', variantId: 'gid://shopify/ProductVariant/64882303271289',
  inventoryItemId: 'gid://shopify/InventoryItem/66927645098361', gramsPerItem: 50,
} as const;
export class StockSourceError extends Error {}

export async function loadSalmonStockSource(db: Pick<PrismaClient, '$transaction'>) {
  return db.$transaction(async tx => {
    const product = await tx.product.findUnique({ where: { id: SALMON_STOCK.productId }, select: {
      id: true, unit: true, status: true, productCategory: true, inventorySourceProductId: true,
      priceTiers: { where: { status: 'active' }, orderBy: { id: 'asc' }, select: {
        id: true, weightGrams: true, unit: true, unitQty: true, shopifySku: true, shopifyVariantId: true, inventoryPolicy: true,
        _count: { select: { bundleComponents: true } },
      } },
      inventoryBalances: { where: { warehouse: { code: 'WH-MAIN' } }, select: { quantity: true, unit: true, updatedAt: true, lastCountedAt: true } },
      _count: { select: { inventoryDerivedProducts: true, bundleIngredientFor: true } },
    } });
    if (!product || product.status !== 'active' || product.productCategory !== 'STANDARD' || product.inventorySourceProductId ||
      !['g', '克', '公克'].includes(product.unit) || product.priceTiers.length !== 1 ||
      product._count.inventoryDerivedProducts || product._count.bundleIngredientFor) throw new StockSourceError('SOURCE_NOT_EXCLUSIVE');
    const tier = product.priceTiers[0];
    if (tier.id !== SALMON_STOCK.tierId || tier.weightGrams !== 50 || tier.unitQty !== 1 ||
      !['g', '克', '公克'].includes(tier.unit) || tier.inventoryPolicy !== 'shared' || tier._count.bundleComponents ||
      tier.shopifySku !== SALMON_STOCK.sku || tier.shopifyVariantId !== '64882303271289') throw new StockSourceError('SOURCE_BINDING_CHANGED');
    if (product.inventoryBalances.length !== 1) throw new StockSourceError('SOURCE_BALANCE_REQUIRED');
    const balance = product.inventoryBalances[0];
    if (!balance.lastCountedAt || !['g', '克', '公克'].includes(balance.unit ?? '') ||
      !Number.isSafeInteger(balance.quantity)) throw new StockSourceError('SOURCE_COUNT_REQUIRED');
    const bindings = await tx.productPriceTier.count({ where: { status: 'active', OR: [
      { shopifyVariantId: '64882303271289' }, { shopifySku: { equals: SALMON_STOCK.sku, mode: 'insensitive' } },
      { sku: { equals: SALMON_STOCK.sku, mode: 'insensitive' } },
    ] } });
    if (bindings !== 1) throw new StockSourceError('DUPLICATE_SOURCE_BINDING');
    const relevant = { OR: [{ productId: SALMON_STOCK.productId }, { sku: SALMON_STOCK.sku }] };
    const items = { where: relevant, orderBy: { id: 'asc' },
      select: { id: true, productId: true, quantity: true, weightGrams: true, variantKey: true } } as const;
    // Keep shipped/completed rows until ledger proves consumption; status alone cannot release demand.
    const orders = await tx.order.findMany({ where: { status: { not: 'cancelled' }, paymentStatus: { not: 'refunded' },
      OR: [{ items: { some: relevant } }, { source: 'shopify' }] },
      select: { id: true, source: true, externalStore: true, externalOrderId: true, shopifySnapshot: true, items,
        shipments: { orderBy: { id: 'asc' }, select: { id: true } } }, orderBy: { id: 'asc' }, take: 1001 });
    const standalone = await tx.shipment.findMany({ where: { orderId: null, status: { not: 'cancelled' },
      items: { some: relevant } }, select: { id: true, items }, orderBy: { id: 'asc' }, take: 1001 });
    if (orders.length > 1000 || standalone.length > 1000) throw new StockSourceError('SOURCE_QUERY_LIMIT');
    for (const order of orders) {
      const raw = JSON.stringify(order.shopifySnapshot ?? {});
      if (!order.items.length && (raw.includes(SALMON_STOCK.sku) || raw.includes('64882303271289'))) throw new StockSourceError('SOURCE_ORDER_UNMAPPED');
    }
    const groups = [...orders.filter(o => o.items.length).map(o => ({ id: o.id, externalStore: o.externalStore,
      externalOrderId: o.externalOrderId, items: o.items, refs: [`order:${o.id}`, ...o.shipments.map(s => `shipment:${s.id}`)] })),
      ...standalone.map(s => ({ id: s.id, externalStore: null, externalOrderId: null, items: s.items, refs: [`shipment:${s.id}`] }))];
    const postings = await tx.inventoryTransaction.findMany({ where: { productId: SALMON_STOCK.productId, type: 'sales_out',
      eventKey: { not: null }, reference: { in: groups.flatMap(g => g.refs) }, warehouse: { code: 'WH-MAIN' } },
      select: { id: true, reference: true, quantity: true, unit: true, reversal: { select: { quantity: true, unit: true } } }, orderBy: { id: 'asc' }, take: 5001 });
    if (postings.length > 5000) throw new StockSourceError('SOURCE_LEDGER_LIMIT');
    for (const p of postings) {
      if (!['g', '克', '公克'].includes(p.unit ?? '') || !Number.isSafeInteger(p.quantity) || p.quantity >= 0 ||
        (p.reversal && (!['g', '克', '公克'].includes(p.reversal.unit ?? '') || p.reversal.quantity !== -p.quantity))) {
        throw new StockSourceError('SOURCE_LEDGER_INVALID');
      }
    }
    let outstandingGrams = 0;
    const externalDemand: { store: string; orderId: string; quantity: number }[] = [];
    for (const group of groups) {
      let total = 0;
      for (const line of group.items) {
        if (line.productId !== product.id || line.weightGrams !== 50 || !Number.isSafeInteger(line.quantity) || line.quantity <= 0 ||
          (line.variantKey && line.variantKey !== tier.id)) throw new StockSourceError('SOURCE_ORDER_TIER_CHANGED');
        total += line.quantity * 50;
      }
      const refs = new Set(group.refs);
      const posted = postings.filter(p => p.reference && refs.has(p.reference))
        .reduce((sum, p) => sum + Math.max(0, -(p.quantity + (p.reversal?.quantity ?? 0))), 0);
      if (!Number.isSafeInteger(total) || !Number.isSafeInteger(posted) || posted > total) throw new StockSourceError('SOURCE_LEDGER_EXCEEDS_ORDER');
      const remaining = Math.max(0, total - posted);
      outstandingGrams += remaining;
      if (group.externalOrderId) {
        if (!group.externalStore || remaining % 50 !== 0) throw new StockSourceError('SOURCE_EXTERNAL_ORDER_INCOMPLETE');
        externalDemand.push({ store: group.externalStore.toLowerCase(), orderId: group.externalOrderId, quantity: remaining / 50 });
      }
    }
    if (!Number.isSafeInteger(outstandingGrams)) throw new StockSourceError('SOURCE_QUANTITY_OVERFLOW');
    // Hash only commercial/inventory state; never persist raw order/customer snapshots in the audit.
    const sourceRevision = createHash('sha256').update(JSON.stringify({ product, groups, postings, externalDemand })).digest('hex');
    return { onHandGrams: balance.quantity, outstandingGrams,
      available: Math.floor(Math.max(0, balance.quantity - outstandingGrams) / 50),
      sourceRevision, externalDemand, observedAt: new Date().toISOString() };
  }, { isolationLevel: 'RepeatableRead', maxWait: 3000, timeout: 15000 });
}
