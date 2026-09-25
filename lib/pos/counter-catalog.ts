import { prisma } from '@/lib/prisma';
import { productCategoryLabel } from '@/lib/labels';
import {
  LEGACY_MERCHANT_STOCK_TIER_ID,
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
import { loadPosMerchantProfile, type PosMerchantProfile } from '@/lib/pos/account';
import {
  hasSellableCounterStock,
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

export async function loadCounterCatalog(
  merchantId: string,
  merchantRequest: Promise<PosMerchantProfile | null> = loadPosMerchantProfile(merchantId),
): Promise<CounterCatalog | null> {
  const [merchant, products] = await Promise.all([
    merchantRequest,
    prisma.product.findMany({
      // 一般收銀只處理寄賣商品。換罐商品必須走 /pos/refill，避免重複計算分潤。
      where: {
        status: 'active',
        productCategory: 'STANDARD',
        OR: [
          { merchantRules: { some: { merchantId } } },
          { merchantStocks: { some: { merchantId } } },
        ],
      },
      select: {
        id: true,
        name: true,
        sku: true,
        category: true,
        unit: true,
        price: true,
        imageUrl: true,
        merchantRules: {
          where: { merchantId },
          select: {
            productId: true,
            suggestedPrice: true,
            commissionMode: true,
            commissionValue: true,
          },
          take: 1,
        },
        merchantStocks: {
          where: { merchantId },
          select: { tierId: true, quantity: true },
        },
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
    }),
  ]);
  if (!merchant) return null;
  if (products.length === 0) {
    return { merchantName: merchant.name, items: [], categories: [], priced: [] };
  }

  const items: CounterCatalogItem[] = [];
  const priced: PricedCounterProduct[] = [];
  const categoryIds = new Set<string>();

  for (const product of products) {
    const rule = product.merchantRules[0] ?? null;
    const stockByTier = new Map(
      product.merchantStocks.map((stock) => [stock.tierId, stock.quantity]),
    );
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
      const exactStock = stockByTier.get(listedTierId);
      const legacyStock = stockByTier.get(LEGACY_MERCHANT_STOCK_TIER_ID);
      const isDefaultTier = !tier || tier.id === defaultTier?.id;
      if (exactStock == null && !isDefaultTier) continue;

      const { stock, sellTierId } = resolveCounterSellStock({
        listedTierId,
        isDefaultTier,
        exactStock,
        legacyStock,
        legacyTierId: LEGACY_MERCHANT_STOCK_TIER_ID,
      });
      if (!hasSellableCounterStock(stock)) continue;
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
