import { prisma } from '@/lib/prisma';

type ProductWithTiers = {
  id: string;
  name: string;
  sku: string;
  price: number;
  priceTiers: { price: number }[];
};

type MerchantRule = {
  productId: string;
  suggestedPrice: number;
  commissionMode: string;
  commissionValue: number;
};

export async function loadActiveMerchantProductCatalog(merchantId: string) {
  const [merchant, products] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: merchantId },
      include: {
        productRules: true,
        stocks: true,
      },
    }),
    prisma.product.findMany({
      where: { status: 'active' },
      include: {
        priceTiers: { orderBy: { price: 'asc' } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!merchant) return null;

  const ruleByProduct = new Map(merchant.productRules.map((rule) => [rule.productId, rule]));
  const stockByProduct = new Map(merchant.stocks.map((stock) => [stock.productId, stock.quantity]));
  const consignedProductIds = new Set(merchant.productRules.map((rule) => rule.productId));

  const sortedProducts = [...products].sort((a, b) => {
    const aRank = consignedProductIds.has(a.id) ? 0 : 1;
    const bRank = consignedProductIds.has(b.id) ? 0 : 1;
    return aRank - bRank || a.name.localeCompare(b.name, 'zh-Hant');
  });

  return {
    merchant,
    products: sortedProducts,
    ruleByProduct,
    stockByProduct,
    consignedProductIds,
  };
}

export function merchantSuggestedUnitPrice(
  product: ProductWithTiers,
  rule?: MerchantRule | null,
) {
  if (rule) return rule.suggestedPrice;
  if (product.priceTiers.length > 0) return product.priceTiers[0].price;
  return product.price;
}

export function merchantCommissionPerUnit(
  rule: MerchantRule | null | undefined,
  unitPrice: number,
) {
  if (!rule) return 0;
  return rule.commissionMode === 'percent'
    ? (unitPrice * rule.commissionValue) / 100
    : rule.commissionValue;
}
