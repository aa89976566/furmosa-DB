export type ShopifySourceLine = {
  title: string;
  sku: string;
  variantId: string;
};

type SourceTier = {
  status: string;
  sku: string | null;
  shopifySku: string | null;
  shopifyVariantId: string | null;
};

export type ProductSourceCatalogItem = {
  id: string;
  sku: string;
  sourceSku: string | null;
  priceTiers: SourceTier[];
  vendor: {
    id: string;
    vendorId: string;
    name: string;
  } | null;
};

function fold(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function productMatches(line: ShopifySourceLine, product: ProductSourceCatalogItem) {
  const activeTiers = product.priceTiers.filter((tier) => tier.status === 'active');
  const variantId = line.variantId.trim();
  if (variantId && activeTiers.some((tier) => tier.shopifyVariantId === variantId)) return true;

  const sku = fold(line.sku);
  if (!sku) return false;
  if (activeTiers.some((tier) => fold(tier.sku) === sku || fold(tier.shopifySku) === sku)) return true;
  return activeTiers.length === 1 && (fold(product.sku) === sku || fold(product.sourceSku) === sku);
}

export type ProductSource = {
  productId: string;
  vendorId: string;
  vendorCode: string;
  vendorName: string;
};

/**
 * Uses exact Shopify variant/SKU bindings. We never guess a source from the product
 * title because a wrong supplier is harmful at packing time.
 */
export function resolveShopifyProductSources(
  lines: ShopifySourceLine[],
  products: ProductSourceCatalogItem[],
): Array<ProductSource | null> {
  const productsById = new Map(products.map((product) => [product.id, product]));

  return lines.map((line) => {
    const matches = products.filter((product) => productMatches(line, product));
    if (matches.length !== 1) return null;

    const product = productsById.get(matches[0]!.id);
    if (!product?.vendor) return null;

    return {
      productId: product.id,
      vendorId: product.vendor.id,
      vendorCode: product.vendor.vendorId,
      vendorName: product.vendor.name,
    };
  });
}
