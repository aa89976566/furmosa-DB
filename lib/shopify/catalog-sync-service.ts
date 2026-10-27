import { createHash, randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { fetchShopifyCatalog } from './catalog-source';
import { planShopifyHqCatalogSync, type CatalogSyncPlan } from './catalog-sync';
import { getShopifyAdminAccessToken, shopifyAdminAuthConfigFromEnv } from './admin-access-token';

export function catalogSyncFingerprint(plan: CatalogSyncPlan) {
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}

export async function loadShopifyCatalogAudit(db: Pick<PrismaClient, 'product'>) {
  const auth = shopifyAdminAuthConfigFromEnv();
  const token = await getShopifyAdminAccessToken(auth);
  const [allShopifyProducts, hqProducts] = await Promise.all([
    fetchShopifyCatalog({ domain: auth.domain, token }),
    db.product.findMany({
      // The storefront audit is an action queue for products HQ still intends to sell.
      // Draft/inactive products keep their historical tiers, but must not block the
      // active-catalog reconciliation after an operator has deliberately retired them.
      where: { productCategory: 'STANDARD', status: 'active' },
      orderBy: [{ productId: 'asc' }, { id: 'asc' }],
      select: {
        id: true, productId: true, name: true, status: true, price: true, sourceSku: true,
        priceTiers: {
          orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }, { id: 'asc' }],
          select: {
            id: true, status: true, sku: true, shopifySku: true, shopifyVariantId: true,
            weightGrams: true, unit: true, unitQty: true, price: true,
          },
        },
      },
    }),
  ]);
  const shopifyProducts = allShopifyProducts.filter((product) => product.status === 'ACTIVE');
  const plan = planShopifyHqCatalogSync(shopifyProducts, hqProducts);
  return { shopifyProducts, hqProducts, plan, fingerprint: catalogSyncFingerprint(plan) };
}

type CatalogSyncTx = Pick<Prisma.TransactionClient, 'productPriceTier' | 'product' | 'statusAuditLog'>;

export async function applyCatalogSyncPlan(tx: CatalogSyncTx, input: {
  plan: CatalogSyncPlan;
  fingerprint: string;
  actorId: string;
}) {
  const changeCount = input.plan.tierUpdates.length + input.plan.productUpdates.length + input.plan.tierArchives.length;
  if (changeCount > 500) throw new Error(`本次變更 ${changeCount} 筆，超過安全上限 500；已停止套用`);
  for (const row of input.plan.tierUpdates) {
    await tx.productPriceTier.update({
      where: { id: row.tierId },
      data: { sku: row.sku, shopifySku: row.shopifySku, shopifyVariantId: row.shopifyVariantId, price: row.price, status: row.status },
    });
  }
  for (const row of input.plan.tierArchives) {
    await tx.productPriceTier.update({ where: { id: row.tierId }, data: { status: 'archived' } });
  }
  for (const row of input.plan.productUpdates) {
    await tx.product.update({ where: { id: row.productId }, data: { name: row.name, price: row.price, status: row.status } });
  }
  const runId = randomUUID();
  await tx.statusAuditLog.create({
    data: {
      entityType: 'shopify_hq_catalog_sync', entityId: runId, newStatus: 'APPLIED',
      actorType: 'user', actorId: input.actorId,
      metadataJson: JSON.stringify({
        fingerprint: input.fingerprint,
        changes: { total: changeCount, tierUpdates: input.plan.tierUpdates.length, productUpdates: input.plan.productUpdates.length, tierArchives: input.plan.tierArchives.length },
        remaining: { conflicts: input.plan.conflicts.length, unmatchedShopifyVariants: input.plan.unmatchedShopifyVariants.length, blankShopifyVariants: input.plan.blankShopifyVariants.length, unmatchedHqTiers: input.plan.unmatchedHqTiers.length },
      }),
    },
  });
  return { runId, changeCount };
}

type CatalogCandidateTx = Pick<Prisma.TransactionClient, 'shopifyCatalogCandidate' | 'statusAuditLog'>;

export async function stageUnmatchedCatalog(tx: CatalogCandidateTx, input: {
  plan: CatalogSyncPlan;
  fingerprint: string;
  actorId: string;
}) {
  const rows = input.plan.unmatchedShopifyVariants.map((row) => ({ ...row, sku: row.sku }));
  if (rows.length > 500) throw new Error(`本次待建商品 ${rows.length} 筆，超過安全上限 500；已停止登記`);

  for (const row of rows) {
    await tx.shopifyCatalogCandidate.upsert({
      where: { shopifyVariantId: row.variantId },
      create: {
        shopifyProductId: row.productId,
        shopifyVariantId: row.variantId,
        productTitle: row.productTitle,
        variantTitle: row.variantTitle,
        sku: row.sku,
        price: row.price,
        shopifyStatus: row.productStatus,
      },
      update: {
        productTitle: row.productTitle,
        variantTitle: row.variantTitle,
        sku: row.sku,
        price: row.price,
        shopifyStatus: row.productStatus,
        lastSeenAt: new Date(),
      },
    });
  }

  // Active Shopify bundle/special variants may intentionally omit SKU. They are
  // visible in the audit for reference, but are not HQ product-creation work.
  if (input.plan.blankShopifyVariants.length > 0) {
    await tx.shopifyCatalogCandidate.updateMany({
      where: {
        shopifyVariantId: { in: input.plan.blankShopifyVariants.map((row) => row.variantId) },
        resolution: 'pending',
      },
      data: { resolution: 'unavailable', notes: 'Shopify 規格不需 SKU；不建立 HQ 庫存商品' },
    });
  }

  const runId = randomUUID();
  await tx.statusAuditLog.create({
    data: {
      entityType: 'shopify_catalog_candidate_import', entityId: runId, newStatus: 'IMPORTED',
      actorType: 'user', actorId: input.actorId,
        metadataJson: JSON.stringify({
          fingerprint: input.fingerprint,
          candidateCount: rows.length,
          ignoredBlankSkuCount: input.plan.blankShopifyVariants.length,
        }),
    },
  });
  return { runId, candidateCount: rows.length };
}
