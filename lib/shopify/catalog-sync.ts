import { canonicalTierSku } from '@/lib/products/canonical-sku';

export type ShopifyCatalogVariant = {
  id: string;
  title: string;
  sku: string | null;
  price: number;
};

export type ShopifyCatalogProduct = {
  id: string;
  title: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  variants: ShopifyCatalogVariant[];
};

export type HqCatalogTier = {
  id: string;
  status: string;
  sku: string | null;
  shopifySku: string | null;
  shopifyVariantId: string | null;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
};

export type HqCatalogProduct = {
  id: string;
  productId: string;
  name: string;
  status: string;
  sourceSku: string | null;
  priceTiers: HqCatalogTier[];
};

export type CatalogTierUpdate = {
  tierId: string;
  productId: string;
  shopifyProductId: string;
  sku: string;
  shopifySku: string;
  shopifyVariantId: string;
  price: number;
  status: 'active';
};

export type CatalogProductUpdate = {
  productId: string;
  shopifyProductId: string;
  name: string;
  price: number;
  status: 'active' | 'draft' | 'inactive';
};

export type CatalogSyncPlan = {
  tierUpdates: CatalogTierUpdate[];
  productUpdates: CatalogProductUpdate[];
  tierArchives: Array<{ tierId: string; productId: string; reason: 'not_in_shopify' }>;
  unmatchedShopifyVariants: Array<{ productId: string; productTitle: string; variantId: string; sku: string }>;
  conflicts: Array<{ code: string; message: string; ids: string[] }>;
  ignoredBlankShopifySkus: number;
};

function fold(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized || null;
}

function numericVariantId(value: string) {
  const tail = value.trim().split('/').pop() ?? '';
  return /^\d+$/.test(tail) ? tail : value.trim();
}

function hqStatus(status: ShopifyCatalogProduct['status']): CatalogProductUpdate['status'] {
  if (status === 'ACTIVE') return 'active';
  if (status === 'DRAFT') return 'draft';
  return 'inactive';
}

/**
 * Builds a conservative plan. It never guesses by title, weight, or price:
 * Shopify and HQ can only meet through an exact, unique SKU/variant identity.
 */
export function planShopifyHqCatalogSync(
  shopifyProducts: ShopifyCatalogProduct[],
  hqProducts: HqCatalogProduct[],
): CatalogSyncPlan {
  const conflicts: CatalogSyncPlan['conflicts'] = [];
  const shopifyBySku = new Map<string, Array<{ product: ShopifyCatalogProduct; variant: ShopifyCatalogVariant }>>();
  let ignoredBlankShopifySkus = 0;

  for (const product of shopifyProducts) {
    for (const variant of product.variants) {
      const sku = fold(variant.sku);
      if (!sku) {
        ignoredBlankShopifySkus++;
        continue;
      }
      const rows = shopifyBySku.get(sku) ?? [];
      rows.push({ product, variant });
      shopifyBySku.set(sku, rows);
    }
  }

  for (const [sku, rows] of shopifyBySku) {
    if (rows.length > 1) {
      conflicts.push({
        code: 'DUPLICATE_SHOPIFY_SKU',
        message: `Shopify SKU ${sku} 對應 ${rows.length} 個規格，不能自動同步`,
        ids: rows.map((row) => row.variant.id),
      });
    }
  }

  const candidates: Array<{
    hqProduct: HqCatalogProduct;
    tier: HqCatalogTier;
    shopifyProduct: ShopifyCatalogProduct;
    variant: ShopifyCatalogVariant;
  }> = [];

  for (const product of hqProducts) {
    const active = product.priceTiers.filter((tier) => tier.status !== 'archived');
    for (const tier of product.priceTiers) {
      const identities = new Set(
        [tier.sku, tier.shopifySku, canonicalTierSku(product.sourceSku, tier, active.length)]
          .map(fold)
          .filter((value): value is string => Boolean(value)),
      );
      const hits = new Map<string, { product: ShopifyCatalogProduct; variant: ShopifyCatalogVariant }>();
      for (const identity of identities) {
        for (const row of shopifyBySku.get(identity) ?? []) hits.set(row.variant.id, row);
      }
      if (hits.size > 1) {
        conflicts.push({
          code: 'AMBIGUOUS_HQ_TIER',
          message: `HQ 規格 ${tier.id} 的身分欄位指向多個 Shopify 規格`,
          ids: [tier.id, ...hits.keys()],
        });
        continue;
      }
      const hit = [...hits.values()][0];
      if (hit) candidates.push({ hqProduct: product, tier, shopifyProduct: hit.product, variant: hit.variant });
    }
  }

  const byVariant = new Map<string, typeof candidates>();
  const byShopifyProduct = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    byVariant.set(candidate.variant.id, [...(byVariant.get(candidate.variant.id) ?? []), candidate]);
    byShopifyProduct.set(candidate.shopifyProduct.id, [...(byShopifyProduct.get(candidate.shopifyProduct.id) ?? []), candidate]);
  }

  const blockedTierIds = new Set<string>();
  for (const [variantId, rows] of byVariant) {
    const distinctTiers = new Set(rows.map((row) => row.tier.id));
    if (distinctTiers.size <= 1) continue;
    rows.forEach((row) => blockedTierIds.add(row.tier.id));
    conflicts.push({
      code: 'DUPLICATE_HQ_VARIANT_CLAIM',
      message: `Shopify 規格 ${variantId} 被多個 HQ 規格認領，需人工選擇保留項目`,
      ids: [variantId, ...distinctTiers],
    });
  }

  for (const [shopifyProductId, rows] of byShopifyProduct) {
    const distinctProducts = new Set(rows.map((row) => row.hqProduct.id));
    if (distinctProducts.size <= 1) continue;
    rows.forEach((row) => blockedTierIds.add(row.tier.id));
    conflicts.push({
      code: 'DUPLICATE_HQ_PRODUCT_CLAIM',
      message: `Shopify 商品 ${shopifyProductId} 被多個 HQ 商品認領，需人工選擇主要商品`,
      ids: [shopifyProductId, ...distinctProducts],
    });
  }

  const accepted = candidates.filter((candidate) => !blockedTierIds.has(candidate.tier.id));
  const tierUpdates: CatalogTierUpdate[] = accepted.map(({ hqProduct, tier, shopifyProduct, variant }) => ({
    tierId: tier.id,
    productId: hqProduct.id,
    shopifyProductId: shopifyProduct.id,
    sku: fold(variant.sku)!,
    shopifySku: fold(variant.sku)!,
    shopifyVariantId: numericVariantId(variant.id),
    price: variant.price,
    status: 'active',
  }));

  const acceptedByHqProduct = new Map<string, typeof accepted>();
  for (const row of accepted) {
    acceptedByHqProduct.set(row.hqProduct.id, [...(acceptedByHqProduct.get(row.hqProduct.id) ?? []), row]);
  }

  const productUpdates: CatalogProductUpdate[] = [];
  const tierArchives: CatalogSyncPlan['tierArchives'] = [];
  for (const product of hqProducts) {
    const rows = acceptedByHqProduct.get(product.id) ?? [];
    const shopifyIds = new Set(rows.map((row) => row.shopifyProduct.id));
    if (shopifyIds.size !== 1) continue;
    const shopifyProduct = rows[0]!.shopifyProduct;
    productUpdates.push({
      productId: product.id,
      shopifyProductId: shopifyProduct.id,
      name: shopifyProduct.title,
      price: Math.min(...rows.map((row) => row.variant.price)),
      status: hqStatus(shopifyProduct.status),
    });
    const matchedTierIds = new Set(rows.map((row) => row.tier.id));
    for (const tier of product.priceTiers) {
      if (tier.status === 'archived' || matchedTierIds.has(tier.id) || blockedTierIds.has(tier.id)) continue;
      tierArchives.push({ tierId: tier.id, productId: product.id, reason: 'not_in_shopify' });
    }
  }

  const claimedShopifyVariants = new Set(accepted.map((row) => row.variant.id));
  const unmatchedShopifyVariants = shopifyProducts.flatMap((product) =>
    product.variants.flatMap((variant) => {
      const sku = fold(variant.sku);
      if (!sku || claimedShopifyVariants.has(variant.id)) return [];
      return [{ productId: product.id, productTitle: product.title, variantId: variant.id, sku }];
    }),
  );

  return {
    tierUpdates,
    productUpdates,
    tierArchives,
    unmatchedShopifyVariants,
    conflicts,
    ignoredBlankShopifySkus,
  };
}
