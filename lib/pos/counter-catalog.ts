import { prisma } from '@/lib/prisma';
import { productCategoryLabel } from '@/lib/labels';
import {
  LEGACY_MERCHANT_STOCK_TIER_ID,
  merchantStockTierMapKey,
} from '@/lib/merchant-stock-key';
import { merchantSuggestedUnitPrice } from '@/lib/merchant-product-catalog';
import {
  pickDefaultTier,
  tierSpecLabel,
  unitPriceForTierSale,
  type MerchantProductTierOption,
} from '@/lib/merchant-product-tier';
import { counterLineKey } from '@/lib/pos/counter-cart';
import { resolveFurmosaProductImage } from '@/lib/pos/furmosa-com-images';
import type { PricedCounterProduct } from '@/lib/pos/counter-sale-plan';
import {
  resolveCounterSellStock,
  type CounterCatalogItem,
} from '@/lib/pos/counter-catalog-view';

export type { CounterCatalogItem };

export type CounterCatalog = {
  merchantName: string;
  items: CounterCatalogItem[];
  categories: { id: string; label: string }[];
  priced: PricedCounterProduct[];
};

export async function loadCounterCatalog(merchantId: string): Promise<CounterCatalog | null> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      name: true,
      productRules: {
        select: {
          productId: true,
          suggestedPrice: true,
          commissionMode: true,
          commissionValue: true,
        },
      },
      stocks: {
        select: {
          productId: true,
          tierId: true,
          quantity: true,
        },
      },
    },
  });
  if (!merchant) return null;

  const productIds = [
    ...new Set([
      ...merchant.productRules.map((rule) => rule.productId),
      ...merchant.stocks.map((stock) => stock.productId),
    ]),
  ];
  if (productIds.length === 0) {
    return { merchantName: merchant.name, items: [], categories: [], priced: [] };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, status: 'active' },
    select: {
      id: true,
      name: true,
      sku: true,
      category: true,
      unit: true,
      price: true,
      imageUrl: true,
      priceTiers: {
        select: {
          id: true,
          weightGrams: true,
          unit: true,
          unitQty: true,
          price: true,
          notes: true,
        },
        orderBy: { price: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });

  const ruleByProduct = new Map(merchant.productRules.map((rule) => [rule.productId, rule]));
  const stockByKey = new Map(
    merchant.stocks.map((stock) => [
      merchantStockTierMapKey(stock.productId, stock.tierId),
      stock.quantity,
    ]),
  );

  const items: CounterCatalogItem[] = [];
  const priced: PricedCounterProduct[] = [];
  const categoryIds = new Set<string>();

  for (const product of products) {
    const rule = ruleByProduct.get(product.id) ?? null;
    const tiers: MerchantProductTierOption[] = product.priceTiers.map((tier) => ({
      id: tier.id,
      weightGrams: tier.weightGrams,
      unit: tier.unit,
      unitQty: tier.unitQty,
      price: tier.price,
      notes: tier.notes,
    }));
    const defaultTier = pickDefaultTier(tiers);
    const offerTiers = tiers.length > 0 ? tiers : [null];

    for (const tier of offerTiers) {
      const listedTierId = tier?.id ?? LEGACY_MERCHANT_STOCK_TIER_ID;
      const exactStock = stockByKey.get(merchantStockTierMapKey(product.id, listedTierId));
      const legacyStock = stockByKey.get(
        merchantStockTierMapKey(product.id, LEGACY_MERCHANT_STOCK_TIER_ID),
      );
      const isDefaultTier = !tier || tier.id === defaultTier?.id;
      if (exactStock == null && !isDefaultTier) continue;

      const { stock, sellTierId } = resolveCounterSellStock({
        listedTierId,
        isDefaultTier,
        exactStock,
        legacyStock,
        legacyTierId: LEGACY_MERCHANT_STOCK_TIER_ID,
      });
      const unitPrice = unitPriceForTierSale(tiers, listedTierId, {
        suggestedPrice: rule?.suggestedPrice ?? null,
        hasMerchantRule: Boolean(rule),
        fallbackPrice: merchantSuggestedUnitPrice(product, rule),
      });
      const specLabel = tierSpecLabel(tier);
      const categoryLabel = productCategoryLabel[product.category] ?? '其他';
      categoryIds.add(product.category);
      items.push({
        key: counterLineKey(product.id, sellTierId),
        productId: product.id,
        tierId: sellTierId,
        name: product.name,
        specLabel,
        category: product.category,
        categoryLabel,
        unitPrice,
        stock,
        imageUrl: resolveFurmosaProductImage(product.name, product.imageUrl),
        unit: tier?.unit ?? product.unit,
      });
      priced.push({
        productId: product.id,
        tierId: sellTierId,
        name: product.name,
        specLabel,
        price: product.price,
        priceTiers: product.priceTiers.map((t) => ({ price: t.price })),
        suggestedPrice: rule?.suggestedPrice ?? null,
        commissionMode: rule?.commissionMode ?? null,
        commissionValue: rule?.commissionValue ?? null,
        stock,
      });
    }
  }

  items.sort((a, b) => {
    const stockRank = Number(b.stock > 0) - Number(a.stock > 0);
    return stockRank || a.name.localeCompare(b.name, 'zh-Hant');
  });

  const categories = [...categoryIds]
    .map((id) => ({ id, label: productCategoryLabel[id] ?? '其他' }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));

  return {
    merchantName: merchant.name,
    items,
    categories,
    priced,
  };
}
