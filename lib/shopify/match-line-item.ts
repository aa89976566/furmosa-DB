import { isMooncakeSearchTerm, MOONCAKE_CATALOG } from '@/lib/products/mooncake-catalog';

export type ShopifyMatchItem = {
  title?: string | null;
  variant_title?: string | null;
  sku?: string | null;
};

export type MatchableProduct = {
  id: string;
  name: string;
  sku: string;
  sourceSku: string | null;
  unit: string;
  priceTiers: { weightGrams: number | null; price: number }[];
};

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function normalizeTitle(value: string) {
  return value
    .replace(/[◈｜|·・,，.\-—_/*＋+]/g, ' ')
    .replace(/\d+\s*(?:g|克)/gi, ' ')
    .replace(/\s+/g, '')
    .trim();
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

export function matchShopifyItemToProduct(
  item: ShopifyMatchItem,
  products: MatchableProduct[],
): MatchableProduct | null {
  const sku = clean(item.sku);
  if (sku) {
    const bySku = products.find((product) => product.sku === sku || product.sourceSku === sku);
    if (bySku) return bySku;
  }

  if (isMooncakeShopifyItem(item)) {
    const mooncake = products.find(
      (product) =>
        product.sourceSku === MOONCAKE_CATALOG.sourceSku || product.name === MOONCAKE_CATALOG.name,
    );
    if (mooncake) return mooncake;
  }

  const title = normalizeTitle(shopifyItemText(item));
  if (!title) return null;

  const hits = products.filter((product) => {
    const name = normalizeTitle(product.name);
    return name.length >= 2 && title.includes(name);
  });
  if (hits.length === 1) return hits[0]!;
  if (hits.length > 1) {
    hits.sort((a, b) => b.name.length - a.name.length);
    if (hits[0]!.name.length > hits[1]!.name.length) return hits[0]!;
  }
  return null;
}

export function resolvedShopifyItemSku(item: ShopifyMatchItem, product: MatchableProduct) {
  return clean(item.sku) ?? product.sourceSku ?? product.sku;
}
