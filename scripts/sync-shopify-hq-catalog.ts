import { prisma } from '../lib/prisma';
import { fetchShopifyCatalog } from '../lib/shopify/catalog-source';
import { planShopifyHqCatalogSync } from '../lib/shopify/catalog-sync';
import { getShopifyAdminAccessToken, shopifyAdminAuthConfigFromEnv } from '../lib/shopify/admin-access-token';
import { applyCatalogSyncPlan, catalogSyncFingerprint } from '../lib/shopify/catalog-sync-service';

function option(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main() {
  const mode = option('mode') ?? 'inspect';
  if (mode !== 'inspect' && mode !== 'apply') throw new Error('mode 只允許 inspect 或 apply');
  const expectedFingerprint = option('expected-fingerprint');
  const allowReviewItems = option('allow-review-items') === 'true';
  if (mode === 'apply' && !expectedFingerprint) {
    throw new Error('apply 前必須先執行 inspect，並提供 --expected-fingerprint=<完整雜湊>');
  }

  const auth = shopifyAdminAuthConfigFromEnv();
  const token = await getShopifyAdminAccessToken(auth);
  const shopifyProducts = await fetchShopifyCatalog({ domain: auth.domain, token });
  const hqProducts = await prisma.product.findMany({
    where: { productCategory: 'STANDARD' },
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
  });

  const plan = planShopifyHqCatalogSync(shopifyProducts, hqProducts);
  const planFingerprint = catalogSyncFingerprint(plan);
  const changeCount = plan.tierUpdates.length + plan.productUpdates.length + plan.tierArchives.length;
  const report = {
    ok: true,
    mode,
    fingerprint: planFingerprint,
    source: { shopifyProducts: shopifyProducts.length, hqProducts: hqProducts.length },
    changes: {
      total: changeCount,
      tierBindingsAndPrices: plan.tierUpdates.length,
      productNamesPricesAndStatuses: plan.productUpdates.length,
      legacyTierArchives: plan.tierArchives.length,
    },
    review: {
      blankShopifyVariants: plan.blankShopifyVariants,
      unmatchedShopifyVariants: plan.unmatchedShopifyVariants,
      unmatchedHqTiers: plan.unmatchedHqTiers,
      conflicts: plan.conflicts,
      ignoredBlankShopifySkus: plan.ignoredBlankShopifySkus,
    },
    plan: {
      tierUpdates: plan.tierUpdates,
      productUpdates: plan.productUpdates,
      tierArchives: plan.tierArchives,
    },
  };

  if (mode === 'inspect') {
    console.log(JSON.stringify(report));
    return;
  }
  const reviewItemCount = plan.conflicts.length + plan.unmatchedShopifyVariants.length
    + plan.blankShopifyVariants.length + plan.unmatchedHqTiers.length;
  if (reviewItemCount > 0 && !allowReviewItems) {
    throw new Error(`目前仍有 ${reviewItemCount} 筆需人工確認；預設禁止部分同步。確認報告後可加 --allow-review-items=true`);
  }
  if (expectedFingerprint !== planFingerprint) {
    throw new Error('Shopify 或 HQ 商品在 inspect 後已變更；已停止套用，請重新檢查差異');
  }
  if (changeCount > 500) throw new Error(`本次變更 ${changeCount} 筆，超過安全上限 500；已停止套用`);

  const { runId } = await prisma.$transaction((tx) => applyCatalogSyncPlan(tx, {
    plan, fingerprint: planFingerprint, actorId: 'catalog-sync-script',
  }));

  console.log(JSON.stringify({ ...report, applied: true, runId }));
}

main()
  .catch((error) => {
    console.error('[SHOPIFY_HQ_CATALOG_SYNC_FAILED]', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
