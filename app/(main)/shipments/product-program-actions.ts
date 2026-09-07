'use server';

import { prisma } from '@/lib/prisma';
import { productProgramLabel } from '@/lib/product-category';

/**
 * Shipment UI lookup only.
 * Product.productCategory is the single source of truth for refill-program labels.
 * Never infer program membership from merchant tags, merchant names, product names, or SKU prefixes.
 */
export async function fetchProductProgramLabels(
  skus: string[],
): Promise<Record<string, string | null>> {
  const uniqueSkus = Array.from(new Set(skus.map((sku) => sku.trim()).filter(Boolean)));
  if (uniqueSkus.length === 0) return {};

  const products = await prisma.product.findMany({
    where: { sku: { in: uniqueSkus } },
    select: { sku: true, productCategory: true },
  });

  return Object.fromEntries(
    products.map((product) => [product.sku, productProgramLabel(product.productCategory)]),
  );
}
