import { prisma } from '../lib/prisma';
import { toTierCatalog } from '../lib/shopify/match-line-item';
import { matchShopifyLineToTier } from '../lib/shopify/match-product-tier';
import { record, string } from '../lib/shopify/intake-policy';

function lineRows(snapshot: unknown) {
  const root = record(snapshot);
  const order = record(root.order);
  return Array.isArray(order.line_items) ? order.line_items.map(record) : [];
}

async function main() {
  const [products, orders] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'active' },
      select: {
        id: true, productId: true, sku: true, sourceSku: true, name: true,
        status: true, defaultTemperature: true, productCategory: true,
        priceTiers: {
          select: {
            id: true, sku: true, shopifySku: true, shopifyVariantId: true,
            status: true, weightGrams: true, unit: true, unitQty: true,
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        externalStore: { not: null },
        shopifySnapshot: { not: undefined },
        deletedAt: null,
        orderedAt: { gte: new Date(Date.now() - 90 * 86400000) },
      },
      orderBy: { orderedAt: 'desc' },
      take: 2000,
      select: {
        id: true, orderNumber: true, externalOrderName: true, orderedAt: true,
        omsStatus: true, status: true, shopifySnapshot: true,
      },
    }),
  ]);

  const catalog = toTierCatalog(products);
  const reasons: Record<string, number> = {};
  const samples: Array<Record<string, unknown>> = [];
  let totalLines = 0;
  let matched = 0;

  for (const order of orders) {
    const rows = lineRows(order.shopifySnapshot);
    rows.forEach((row, index) => {
      totalLines++;
      const sku = string(row.sku);
      const variantId = row.variant_id;
      const title = string(row.title);
      const decision = matchShopifyLineToTier({ sku, variant_id: variantId, title }, catalog);
      if (decision.outcome === 'match') {
        matched++;
        return;
      }
      reasons[decision.reason] = (reasons[decision.reason] ?? 0) + 1;
      if (samples.length < 100) {
        samples.push({
          orderNumber: order.orderNumber,
          externalOrderName: order.externalOrderName,
          orderedAt: order.orderedAt,
          omsStatus: order.omsStatus,
          lineIndex: index + 1,
          title,
          sku,
          variantId: variantId == null ? null : String(variantId),
          reason: decision.reason,
        });
      }
    });
  }

  const activeTiers = products.flatMap(p => p.priceTiers.filter(t => t.status === 'active').map(t => ({...t, productId:p.id, productName:p.name, productSku:p.sku, sourceSku:p.sourceSku})));
  const zeroTierProducts = products.filter(p => p.priceTiers.filter(t => t.status === 'active').length === 0)
    .map(p => ({ productId: p.productId, name: p.name, sku: p.sku, sourceSku: p.sourceSku, defaultTemperature: p.defaultTemperature }));

  const tierMissingIdentity = activeTiers.filter(t => !t.shopifyVariantId && !t.shopifySku && !t.sku)
    .map(t => ({ productName:t.productName, productSku:t.productSku, tierId:t.id, weightGrams:t.weightGrams, unit:t.unit, unitQty:t.unitQty }));

  const keyMap = new Map<string, Array<Record<string, unknown>>>();
  for (const t of activeTiers) {
    for (const [kind, value] of [['shopifyVariantId',t.shopifyVariantId],['shopifySku',t.shopifySku],['tierSku',t.sku]] as const) {
      const v = value?.trim().toLowerCase();
      if (!v) continue;
      const key = kind + ':' + v;
      const arr = keyMap.get(key) ?? [];
      arr.push({ productName:t.productName, productSku:t.productSku, tierId:t.id, value });
      keyMap.set(key, arr);
    }
  }
  const duplicateIdentities = [...keyMap.entries()].filter(([,rows]) => rows.length > 1)
    .slice(0,100).map(([key,rows]) => ({ key, rows }));

  console.log(JSON.stringify({
    ok: true,
    windowDays: 90,
    ordersScanned: orders.length,
    totalLines,
    matched,
    matchRate: totalLines ? Number((matched / totalLines * 100).toFixed(2)) : 100,
    unmapped: totalLines - matched,
    reasons,
    catalog: {
      activeProducts: products.length,
      activeTiers: activeTiers.length,
      zeroTierProductsCount: zeroTierProducts.length,
      zeroTierProducts,
      tierMissingIdentityCount: tierMissingIdentity.length,
      tierMissingIdentity,
      duplicateIdentityCount: duplicateIdentities.length,
      duplicateIdentities,
    },
    unmappedSamples: samples,
  }));
}

main()
  .catch(error => {
    console.error('[OMS_MAPPING_AUDIT_FAILED]', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
