/**
 * 補貨申請規格驗證邏輯
 * 檢查商品是否有多重量級距；如有,強制要求選擇規格
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type ProductVariantInfo = {
  productId: string;
  hasMultipleWeights: boolean;
  weights: number[];
  defaultWeight?: number;
};

/**
 * 檢查商品是否有多個重量規格
 * 返回規格資訊供 SELF_SELECT 表單和驗證使用
 */
export async function getProductVariantInfo(
  productId: string,
): Promise<ProductVariantInfo | null> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      priceTiers: {
        select: {
          id: true,
          weightGrams: true,
        },
      },
    },
  });

  if (!product) return null;

  const weights = product.priceTiers
    .filter((t) => t.weightGrams != null)
    .map((t) => t.weightGrams as number)
    .sort((a, b) => a - b);

  const uniqueWeights = Array.from(new Set(weights));

  return {
    productId,
    hasMultipleWeights: uniqueWeights.length > 1,
    weights: uniqueWeights,
    defaultWeight: uniqueWeights.length > 0 ? uniqueWeights[0] : undefined,
  };
}

/**
 * 批次檢查商品規格要求
 * 返回需要強制規格選擇的商品清單
 */
export async function checkProductsRequireVariant(
  productIds: string[],
): Promise<Map<string, ProductVariantInfo>> {
  const variants = new Map<string, ProductVariantInfo>();

  for (const productId of productIds) {
    const info = await getProductVariantInfo(productId);
    if (info) {
      variants.set(productId, info);
    }
  }

  return variants;
}

/**
 * SELF_SELECT 補貨申請時的規格驗證
 * 商品若有多個重量,必須提供 weightGrams,否則拒絕
 */
export async function validateRestockItemVariants(
  items: Array<{ productId: string; weightGrams?: number | null }>,
): Promise<{ valid: true } | { valid: false; errors: string[] }> {
  const errors: string[] = [];
  const variants = await checkProductsRequireVariant(
    items.map((i) => i.productId),
  );

  for (const item of items) {
    const variant = variants.get(item.productId);
    if (variant?.hasMultipleWeights) {
      if (item.weightGrams == null || item.weightGrams <= 0) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true },
        });
        errors.push(
          `「${product?.name || item.productId}」有多個重量規格(${variant.weights.join('g, ')}g),請選擇具體規格。`,
        );
      }
    }
  }

  return errors.length > 0
    ? { valid: false, errors }
    : { valid: true };
}

