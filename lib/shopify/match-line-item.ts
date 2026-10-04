import { isMooncakeSearchTerm, MOONCAKE_CATALOG } from '@/lib/products/mooncake-catalog';
import { matchShopifyLineToTier, type TierCatalogProduct } from '@/lib/shopify/match-product-tier';

export type ShopifyMatchItem = {
  title?: string | null;
  variant_title?: string | null;
  variant_id?: unknown;
  sku?: string | null;
};

export type MatchableTierShape = {
  id?: string;
  weightGrams: number | null;
  price: number;
  unit?: string;
  unitQty?: number;
  sku?: string | null;
  shopifyVariantId?: string | null;
  shopifySku?: string | null;
  status?: string;
  defaultWholesaleUnitPrice?: number | null;
  defaultConsignmentCommissionMode?: string | null;
  defaultConsignmentCommissionValue?: number | null;
};

export type ProductIdentity = {
  id: string;
  name: string;
  sku: string;
  sourceSku?: string | null;
};

export type MatchableProduct = ProductIdentity & {
  unit: string;
  priceTiers: MatchableTierShape[];
};

export function toTierCatalog<T extends ProductIdentity>(products: T[]): TierCatalogProduct[] {
  return products.map((product) => {
    const matchable = product as T & Partial<MatchableProduct>;
    const unit = matchable.unit ?? '件';
    const tiers = matchable.priceTiers ?? [];
    return {
      id: product.id,
      sku: product.sku,
      sourceSku: product.sourceSku ?? null,
      name: product.name,
      unit,
      priceTiers: tiers.map((tier) => ({
        id: tier.id ?? '',
        productId: product.id,
        sku: tier.sku ?? null,
        shopifyVariantId: tier.shopifyVariantId ?? null,
        shopifySku: tier.shopifySku ?? null,
        status: tier.status ?? 'active',
        weightGrams: tier.weightGrams,
        unit: tier.unit ?? unit,
        unitQty: tier.unitQty ?? 1,
        price: tier.price,
        defaultWholesaleUnitPrice: tier.defaultWholesaleUnitPrice ?? null,
        defaultConsignmentCommissionMode: tier.defaultConsignmentCommissionMode ?? null,
        defaultConsignmentCommissionValue: tier.defaultConsignmentCommissionValue ?? null,
      })),
    };
  });
}

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function shopifyItemText(item: ShopifyMatchItem) {
  return [clean(item.title), clean(item.variant_title), clean(item.sku)].filter(Boolean).join(' ');
}

export function shopifyLineItemHasIdentity(item: ShopifyMatchItem) {
  return Boolean(clean(item.sku) || clean(item.title));
}

export function isMooncakeShopifyItem(item: ShopifyMatchItem) {
  const text = shopifyItemText(item);
  return text.includes(MOONCAKE_CATALOG.sourceSku) || isMooncakeSearchTerm(text);
}

/** Exact variant binding, then unique SKU, then explicit controlled title aliases. */
export function matchShopifyItemToProduct<T extends ProductIdentity>(
  item: ShopifyMatchItem,
  products: T[],
): T | null {
  const decision = matchShopifyLineToTier({ variant_id: item.variant_id, sku: item.sku, title: item.title }, toTierCatalog(products));
  if (decision.outcome !== 'match') return null;
  return products.find((product) => product.id === decision.productId) ?? null;
}

export function resolvedShopifyItemSku(item: ShopifyMatchItem, product: MatchableProduct) {
  return clean(item.sku) ?? product.sourceSku ?? product.sku;
}
