import { normalizeLegacyProductName } from './legacy-catalog-reference';

type NamedProduct = { id: string; name: string };

export function matchingExistingProducts(input: {
  products: NamedProduct[];
  shopifyProductTitle: string;
  canonicalProductName?: string | null;
}): NamedProduct[] {
  const exactTitle = normalizeLegacyProductName(input.shopifyProductTitle);
  const exactMatches = input.products.filter((product) => (
    normalizeLegacyProductName(product.name) === exactTitle
  ));
  if (exactMatches.length > 0) return exactMatches;

  const canonicalName = input.canonicalProductName
    ? normalizeLegacyProductName(input.canonicalProductName)
    : null;
  return canonicalName
    ? input.products.filter((product) => normalizeLegacyProductName(product.name) === canonicalName)
    : [];
}
