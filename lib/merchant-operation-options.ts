import { prisma } from '@/lib/prisma';
import {
  isMultiWeightProduct,
  LEGACY_MERCHANT_STOCK_TIER_ID,
  weightTiersForProduct,
} from '@/lib/merchant-stock-key';
import { variationLabel } from '@/lib/product-variations';
import {
  loadActiveMerchantProductCatalog,
  merchantSuggestedUnitPrice,
} from '@/lib/merchant-product-catalog';
import { resolveProductWeightLabel } from '@/lib/product-label';
import {
  resolveMerchantShippingDefaults,
  type MerchantShippingDefaults,
} from '@/lib/merchant-shipping-defaults';
import { ensureZhuwoConsignmentBranches } from '@/lib/stores/ensure-zhuwo-merchants';

export async function listMerchantsForSelect() {
  await ensureZhuwoConsignmentBranches();
  return prisma.merchant.findMany({
    where: { status: 'active' },
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
  rowKey: string;
  productId: string;
  tierId: string;
  tierLabel: string | null;
  name: string;
  sku: string;
  quantity: number;
  isConsigned: boolean;
  lastRestockAt: Date | null;
  lastSaleAt: Date | null;
  lastCountAt: Date | null;
};

/** 清點頁：該店已進貨／現有庫存（多規格商品拆成各克數一列） */
export async function loadMerchantStockSnapshot(
  merchantId: string,
): Promise<MerchantStockSnapshotRow[] | null> {
  const stocks = await prisma.merchantStock.findMany({
    where: {
      merchantId,
      OR: [{ quantity: { gt: 0 } }, { lastRestockAt: { not: null } }],
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          priceTiers: { orderBy: { price: 'asc' } },
        },
      },
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

  const stocksByProduct = new Map<string, typeof stocks>();
  for (const stock of stocks) {
    const list = stocksByProduct.get(stock.productId) ?? [];
    list.push(stock);
    stocksByProduct.set(stock.productId, list);
  }

  const rows: MerchantStockSnapshotRow[] = [];

  for (const [productId, productStocks] of stocksByProduct) {
    const product = productStocks[0]!.product;
    const weightTiers = weightTiersForProduct(product.priceTiers);
    const isConsigned = consigned.has(productId);

    if (isMultiWeightProduct(product.priceTiers)) {
      const tierStockById = new Map(
        productStocks
          .filter((stock) => stock.tierId !== LEGACY_MERCHANT_STOCK_TIER_ID)
          .map((stock) => [stock.tierId, stock]),
      );
      const legacyStock = productStocks.find(
        (stock) => stock.tierId === LEGACY_MERCHANT_STOCK_TIER_ID,
      );

      // 只列「此店曾有庫存紀錄」的規格，不預先展開未進貨的克數
      for (const tier of weightTiers) {
        const tierStock = tierStockById.get(tier.id);
        if (!tierStock) continue;
        rows.push({
          rowKey: `${productId}:${tier.id}`,
          productId,
          tierId: tier.id,
          tierLabel: variationLabel(tier),
          name: product.name,
          sku: product.sku,
          quantity: tierStock.quantity,
          isConsigned,
          lastRestockAt: tierStock.lastRestockAt ?? legacyStock?.lastRestockAt ?? null,
          lastSaleAt: tierStock.lastSaleAt,
          lastCountAt: tierStock.lastCountAt,
        });
      }

      if (legacyStock) {
        rows.push({
          rowKey: `${productId}:legacy`,
          productId,
          tierId: LEGACY_MERCHANT_STOCK_TIER_ID,
          tierLabel: '未分規格',
          name: product.name,
          sku: product.sku,
          quantity: legacyStock.quantity,
          isConsigned,
          lastRestockAt: legacyStock.lastRestockAt,
          lastSaleAt: legacyStock.lastSaleAt,
          lastCountAt: legacyStock.lastCountAt,
        });
      }
      continue;
    }

    const stock =
      productStocks.find((item) => item.tierId === LEGACY_MERCHANT_STOCK_TIER_ID) ??
      productStocks[0]!;
    const matchedTier = product.priceTiers.find((tier) => tier.id === stock.tierId) ?? null;
    rows.push({
      rowKey: productId,
      productId,
      tierId: stock.tierId,
      tierLabel:
        stock.tierId === LEGACY_MERCHANT_STOCK_TIER_ID
          ? '未分規格'
          : matchedTier
            ? variationLabel(matchedTier)
            : null,
      name: product.name,
      sku: product.sku,
      quantity: stock.quantity,
      isConsigned,
      lastRestockAt: stock.lastRestockAt,
      lastSaleAt: stock.lastSaleAt,
      lastCountAt: stock.lastCountAt,
    });
  }

  return rows.sort(
    (a, b) =>
      b.quantity - a.quantity ||
      a.name.localeCompare(b.name, 'zh-Hant') ||
      (a.tierLabel ?? '').localeCompare(b.tierLabel ?? '', 'zh-Hant'),
  );
}

/** 已寄出／已送達但尚未寫入店家庫存的進貨出貨單 */
export async function loadUnpostedMerchantRestocks(merchantId: string) {
  const shipments = await prisma.shipment.findMany({
    where: {
      merchantId,
      type: 'merchant_restock',
      status: { in: ['shipped', 'delivered'] },
    },
    select: {
      id: true,
      shipmentNumber: true,
      status: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (shipments.length === 0) return [];

  const postedNotes = await prisma.merchantStockTxn.findMany({
    where: {
      merchantId,
      type: 'restock',
      note: { contains: '來自出貨單' },
    },
    select: { note: true },
  });
  const postedNumbers = new Set(
    postedNotes
      .map((row) => row.note?.match(/SHP-\d{6}-\d+/)?.[0])
      .filter((value): value is string => Boolean(value)),
  );

  return shipments.filter((s) => !postedNumbers.has(s.shipmentNumber));
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
      weightLabel: resolveProductWeightLabel(product.name, product.priceTiers),
      priceTiers: product.priceTiers.map((tier) => ({
        id: tier.id,
        weightGrams: tier.weightGrams,
        unit: tier.unit,
        unitQty: tier.unitQty,
        price: tier.price,
        notes: tier.notes,
      })),
    };
  });
}
