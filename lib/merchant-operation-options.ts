import { prisma } from '@/lib/prisma';
import {
  loadActiveMerchantProductCatalog,
  merchantSuggestedUnitPrice,
} from '@/lib/merchant-product-catalog';
import {
  resolveMerchantShippingDefaults,
  type MerchantShippingDefaults,
} from '@/lib/merchant-shipping-defaults';

export async function listMerchantsForSelect() {
  return prisma.merchant.findMany({
    select: { id: true, name: true, merchantId: true },
    orderBy: { merchantId: 'asc' },
  });
}

export function resolveSelectedMerchantId(
  merchants: { id: string }[],
  preferredId?: string,
) {
  if (preferredId && merchants.some((merchant) => merchant.id === preferredId)) {
    return preferredId;
  }
  return merchants[0]?.id ?? '';
}

export async function loadMerchantShippingDefaults(
  merchantId: string,
): Promise<MerchantShippingDefaults | null> {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      name: true,
      contactName: true,
      phone: true,
      address: true,
      city: true,
      preferredCarrier: true,
      pickupStoreName: true,
    },
  });
  if (!merchant) return null;

  const lastRestock = await prisma.shipment.findFirst({
    where: { merchantId, type: 'merchant_restock' },
    orderBy: { createdAt: 'desc' },
    select: {
      carrier: true,
      recipientName: true,
      recipientPhone: true,
      recipientAddress: true,
    },
  });

  return resolveMerchantShippingDefaults(merchant, lastRestock);
}

export async function loadMerchantRestockProductOptions(merchantId: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: {
      productRules: { select: { productId: true } },
      stocks: { select: { productId: true, quantity: true } },
    },
  });
  if (!merchant) return null;

  const allProducts = await prisma.product.findMany({
    where: { status: 'active' },
    include: {
      priceTiers: { orderBy: { price: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });

  const stockMap = new Map(merchant.stocks.map((stock) => [stock.productId, stock.quantity]));
  const ruleProductIds = new Set(merchant.productRules.map((rule) => rule.productId));

  const sortedProducts = [...allProducts].sort((a, b) => {
    const aRank = ruleProductIds.has(a.id) ? 0 : 1;
    const bRank = ruleProductIds.has(b.id) ? 0 : 1;
    return aRank - bRank || a.name.localeCompare(b.name, 'zh-Hant');
  });

  return sortedProducts.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
    isConsigned: ruleProductIds.has(product.id),
    currentStock: stockMap.get(product.id) ?? 0,
    defaultUnit: product.unit,
    priceTiers: product.priceTiers.map((tier) => ({
      id: tier.id,
      weightGrams: tier.weightGrams,
      unit: tier.unit,
      unitQty: tier.unitQty,
      price: tier.price,
      notes: tier.notes,
    })),
  }));
}

export type MerchantStockSnapshotRow = {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  isConsigned: boolean;
  lastRestockAt: Date | null;
  lastSaleAt: Date | null;
  lastCountAt: Date | null;
};

/** 清點頁：該店已進貨／現有庫存（有庫存或曾有進貨紀錄） */
export async function loadMerchantStockSnapshot(
  merchantId: string,
): Promise<MerchantStockSnapshotRow[] | null> {
  const stocks = await prisma.merchantStock.findMany({
    where: {
      merchantId,
      OR: [{ quantity: { gt: 0 } }, { lastRestockAt: { not: null } }],
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
    orderBy: [{ quantity: 'desc' }, { product: { name: 'asc' } }],
  });

  if (stocks.length === 0) {
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true },
    });
    if (!merchant) return null;
    return [];
  }

  const rules = await prisma.merchantProductRule.findMany({
    where: { merchantId },
    select: { productId: true },
  });
  const consigned = new Set(rules.map((r) => r.productId));

  return stocks.map((s) => ({
    productId: s.product.id,
    name: s.product.name,
    sku: s.product.sku,
    quantity: s.quantity,
    isConsigned: consigned.has(s.productId),
    lastRestockAt: s.lastRestockAt,
    lastSaleAt: s.lastSaleAt,
    lastCountAt: s.lastCountAt,
  }));
}

export async function loadMerchantAdjustProductOptions(merchantId: string) {
  const catalog = await loadActiveMerchantProductCatalog(merchantId);
  if (!catalog) return null;

  const { products, ruleByProduct, stockByProduct, consignedProductIds } = catalog;

  return products.map((product) => {
    const rule = ruleByProduct.get(product.id);
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      isConsigned: consignedProductIds.has(product.id),
      currentStock: stockByProduct.get(product.id) ?? 0,
      suggestedPrice: merchantSuggestedUnitPrice(product, rule),
      commissionMode: rule?.commissionMode ?? null,
      commissionValue: rule?.commissionValue ?? null,
    };
  });
}
