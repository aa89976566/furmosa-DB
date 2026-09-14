import { prisma } from '@/lib/prisma';
import { isMultiWeightProduct } from '@/lib/merchant-stock-key';
import {
  buildMerchantProductTierStocks,
  toMerchantProductTierOptions,
  type MerchantProductTierStock,
} from '@/lib/merchant-product-tier-stocks';
import type { MerchantProductTierOption } from '@/lib/merchant-product-tier';
import { productProgramLabel } from '@/lib/product-category';

export type MerchantProductListRow = {
  productId: string;
  productName: string;
  sku: string;
  productInternalId: string;
  quantity: number;
  suggestedPrice: number | null;
  commissionMode: string | null;
  commissionValue: number | null;
  commissionPerUnit: number | null;
  companyRevenuePerUnit: number | null;
  ruleId: string | null;
  lastRestockAt: Date | null;
  multiWeightTiers: boolean;
  priceTiers: MerchantProductTierOption[];
  tierStocks: MerchantProductTierStock[];
  productCategory: string;
  programLabel: '換罐計劃' | null;
};

const productSelect = {
  id: true,
  productId: true,
  name: true,
  sku: true,
  productCategory: true,
  priceTiers: {
    select: {
      id: true,
      weightGrams: true,
      unit: true,
      unitQty: true,
      price: true,
      notes: true,
    },
    orderBy: { price: 'asc' as const },
  },
};

/**
 * 寄賣「商品與庫存」頁：兩次輕量查詢 + 記憶體組裝。
 * 最近進貨用 MerchantStock.lastRestockAt，不做每列 shipment findFirst。
 */
export async function loadMerchantProductListRows(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      merchantId: true,
      name: true,
      stocks: {
        select: {
          productId: true,
          tierId: true,
          quantity: true,
          lastRestockAt: true,
        },
      },
      productRules: {
        select: {
          id: true,
          productId: true,
          suggestedPrice: true,
          commissionMode: true,
          commissionValue: true,
        },
      },
    },
  });
  if (!merchant) return null;

  const productIds = [
    ...new Set([
      ...merchant.stocks.map((s) => s.productId),
      ...merchant.productRules.map((r) => r.productId),
    ]),
  ];

  const products =
    productIds.length === 0
      ? []
      : await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: productSelect,
        });

  const productById = new Map(products.map((p) => [p.id, p]));
  const stockRows = merchant.stocks.map((s) => ({
    productId: s.productId,
    tierId: s.tierId,
    quantity: s.quantity,
  }));

  const rows = new Map<string, MerchantProductListRow>();

  for (const stock of merchant.stocks) {
    const product = productById.get(stock.productId);
    if (!product) continue;
    const existing = rows.get(stock.productId);
    if (existing) {
      if (
        stock.lastRestockAt &&
        (!existing.lastRestockAt || stock.lastRestockAt > existing.lastRestockAt)
      ) {
        existing.lastRestockAt = stock.lastRestockAt;
      }
      continue;
    }
    const tiers = toMerchantProductTierOptions(product.priceTiers);
    const built = buildMerchantProductTierStocks(product.id, tiers, stockRows);
    rows.set(stock.productId, {
      productId: product.productId,
      productName: product.name,
      sku: product.sku,
      productInternalId: product.id,
      quantity: built.totalQuantity,
      suggestedPrice: null,
      commissionMode: null,
      commissionValue: null,
      commissionPerUnit: null,
      companyRevenuePerUnit: null,
      ruleId: null,
      lastRestockAt: stock.lastRestockAt,
      multiWeightTiers: isMultiWeightProduct(tiers),
      priceTiers: tiers,
      tierStocks: built.tierStocks,
      productCategory: product.productCategory,
      programLabel: productProgramLabel(product.productCategory),
    });
  }

  for (const rule of merchant.productRules) {
    const product = productById.get(rule.productId);
    if (!product) continue;
    const perUnit =
      rule.commissionMode === 'percent'
        ? (rule.suggestedPrice * rule.commissionValue) / 100
        : rule.commissionValue;
    const tiers = toMerchantProductTierOptions(product.priceTiers);
    const built = buildMerchantProductTierStocks(product.id, tiers, stockRows);
    const existing = rows.get(rule.productId);
    if (existing) {
      const isRefill = product.productCategory === 'JAR_EXCHANGE';
      existing.suggestedPrice = rule.suggestedPrice;
      existing.commissionMode = isRefill ? null : rule.commissionMode;
      existing.commissionValue = isRefill ? null : rule.commissionValue;
      existing.commissionPerUnit = isRefill ? null : perUnit;
      existing.companyRevenuePerUnit = isRefill ? null : rule.suggestedPrice - perUnit;
      existing.ruleId = rule.id;
      existing.multiWeightTiers = isMultiWeightProduct(tiers);
      existing.priceTiers = tiers;
      existing.quantity = built.totalQuantity;
      existing.tierStocks = built.tierStocks;
    } else {
      rows.set(rule.productId, {
        productId: product.productId,
        productName: product.name,
        sku: product.sku,
        productInternalId: product.id,
        quantity: built.totalQuantity,
        suggestedPrice: rule.suggestedPrice,
        commissionMode: product.productCategory === 'JAR_EXCHANGE' ? null : rule.commissionMode,
        commissionValue: product.productCategory === 'JAR_EXCHANGE' ? null : rule.commissionValue,
        commissionPerUnit: product.productCategory === 'JAR_EXCHANGE' ? null : perUnit,
        companyRevenuePerUnit:
          product.productCategory === 'JAR_EXCHANGE' ? null : rule.suggestedPrice - perUnit,
        ruleId: rule.id,
        lastRestockAt: null,
        multiWeightTiers: isMultiWeightProduct(tiers),
        priceTiers: tiers,
        tierStocks: built.tierStocks,
        productCategory: product.productCategory,
        programLabel: productProgramLabel(product.productCategory),
      });
    }
  }

  return {
    merchantId: merchant.id,
    merchantCode: merchant.merchantId,
    merchantName: merchant.name,
    rows: [...rows.values()].sort((a, b) =>
      a.productName.localeCompare(b.productName, 'zh-Hant'),
    ),
  };
}
