import { prisma } from '@/lib/prisma';
import { customerSearchWhere, productSearchWhere } from '@/lib/site-search';
import { loadMerchantWholesalePrices } from '@/lib/merchant-wholesale-prices';
import type { MerchantWholesalePriceRow } from '@/lib/orders/merchant-wholesale-price';
import type { Prisma } from '@prisma/client';

export type OrderFormCustomerHit = {
  id: string;
  name: string;
  customerId: string;
  phone: string | null;
  address: string | null;
  preferredShippingMethod: string | null;
  preferredCvsBrand: string | null;
  preferredCvsStoreId: string | null;
  preferredCvsStoreName: string | null;
};

export type OrderFormProductHit = {
  id: string;
  name: string;
  sku: string;
  productCategory: string;
  availableStock: number;
  price: number;
  cost: number;
  unit: string;
  priceTiers: {
    id: string;
    weightGrams: number | null;
    unit: string;
    unitQty: number;
    price: number;
    cost: number | null;
    defaultWholesaleUnitPrice: number | null;
    notes: string | null;
  }[];
  wholesalePrices: MerchantWholesalePriceRow[];
  merchantSuggestedPrice: number | null;
  consignmentEnabled: boolean | null;
  wholesaleEnabled: boolean | null;
  jarExchangeEnabled: boolean | null;
  businessTier: string | null;
  defaultConsignmentCommissionMode: string | null;
  defaultConsignmentCommissionValue: number | null;
  defaultWholesaleUnitPrice: number | null;
  commercialTermsVersion: number | null;
  merchantCommissionMode: string | null;
  merchantCommissionValue: number | null;
  merchantCommercialContextId: string | null;
};

const customerSelect = {
  id: true,
  name: true,
  customerId: true,
  phone: true,
  address: true,
  preferredShippingMethod: true,
  preferredCvsBrand: true,
  preferredCvsStoreId: true,
  preferredCvsStoreName: true,
} as const;

const productSelect = {
  id: true,
  name: true,
  sku: true,
  productCategory: true,
  businessTier: true,
  defaultConsignmentCommissionMode: true,
  defaultConsignmentCommissionValue: true,
  defaultWholesaleUnitPrice: true,
  commercialTermsVersion: true,
  consignmentEnabled: true,
  wholesaleEnabled: true,
  jarExchangeEnabled: true,
  price: true,
  cost: true,
  unit: true,
  inventoryBalances: {
    select: { quantity: true },
  },
  priceTiers: {
    orderBy: [{ weightGrams: 'asc' as const }, { unitQty: 'asc' as const }],
    select: {
      id: true,
      weightGrams: true,
      unit: true,
      unitQty: true,
      price: true,
      cost: true,
      defaultWholesaleUnitPrice: true,
      notes: true,
    },
  },
};

export type OrderFormProductScope =
  | 'all'
  | 'customer_standard'
  | 'merchant_standard'
  | 'merchant_jar_exchange';

export function orderFormProductScopeWhere(
  scope: OrderFormProductScope,
): Prisma.ProductWhereInput {
  if (scope === 'customer_standard' || scope === 'merchant_standard') {
    return { productCategory: 'STANDARD' };
  }
  if (scope === 'merchant_jar_exchange') {
    return { productCategory: 'JAR_EXCHANGE' };
  }
  return {};
}

function toOrderFormProductHit(
  row: Awaited<ReturnType<typeof findProductsForOrderForm>>[number],
  wholesalePrices: MerchantWholesalePriceRow[] = [],
  merchantSuggestedPrices: Map<string, number> = new Map(),
  merchantCommissionRules: Map<string, { mode: string; value: number }> = new Map(),
  merchantCommercialContextId: string | null = null,
): OrderFormProductHit {
  const commissionRule = merchantCommissionRules.get(row.id);
  return {
    id: row.id,
    name: row.name,
    sku: row.sku,
    productCategory: row.productCategory,
    availableStock: row.inventoryBalances.reduce((sum, balance) => sum + balance.quantity, 0),
    price: row.price,
    cost: row.cost,
    unit: row.unit,
    priceTiers: row.priceTiers,
    wholesalePrices: wholesalePrices.filter((price) => price.productId === row.id),
    merchantSuggestedPrice: merchantSuggestedPrices.get(row.id) ?? null,
    consignmentEnabled: row.consignmentEnabled,
    wholesaleEnabled: row.wholesaleEnabled,
    jarExchangeEnabled: row.jarExchangeEnabled,
    businessTier: row.businessTier,
    defaultConsignmentCommissionMode: row.defaultConsignmentCommissionMode,
    defaultConsignmentCommissionValue: row.defaultConsignmentCommissionValue,
    defaultWholesaleUnitPrice: row.defaultWholesaleUnitPrice,
    commercialTermsVersion: row.commercialTermsVersion,
    merchantCommissionMode: commissionRule?.mode ?? null,
    merchantCommissionValue: commissionRule?.value ?? null,
    merchantCommercialContextId,
  };
}

function findProductsForOrderForm(
  q: string,
  take: number,
  scope: OrderFormProductScope,
  merchantOrderMode?: 'consignment' | 'wholesale' | 'jar_exchange',
) {
  const term = q.trim();
  const search = term ? productSearchWhere(term) : undefined;

  const scopedMode = scope === 'merchant_standard' || scope === 'merchant_jar_exchange'
    ? merchantOrderMode
    : undefined;
  const modeEligibility: Prisma.ProductWhereInput = scopedMode === 'consignment'
    ? { OR: [{ consignmentEnabled: true }, { consignmentEnabled: null }] }
    : scopedMode === 'wholesale'
      ? { OR: [{ wholesaleEnabled: true }, { wholesaleEnabled: null }] }
      : scopedMode === 'jar_exchange'
        ? { OR: [{ jarExchangeEnabled: true }, { jarExchangeEnabled: null }] }
        : {};

  return prisma.product.findMany({
    where: {
      status: 'active',
      AND: [orderFormProductScopeWhere(scope), modeEligibility, search ?? {}],
    },
    orderBy: { name: 'asc' },
    select: productSelect,
    take,
  });
}

/** 訂單／訂閱表單：客戶 typeahead（空字串回傳近期客戶） */
export async function searchCustomersForOrderForm(
  q: string,
  take = 40,
): Promise<OrderFormCustomerHit[]> {
  const term = q.trim();
  const where = term
    ? customerSearchWhere(term)
    : undefined;

  return prisma.customer.findMany({
    where,
    orderBy: term
      ? [{ name: 'asc' }]
      : [{ hasActiveSubscription: 'desc' }, { lastOrderAt: 'desc' }, { name: 'asc' }],
    select: customerSelect,
    take,
  });
}

/** 訂單表單：商品 typeahead（含價位規格；空字串回傳近期上架） */
export async function searchProductsForOrderForm(
  q: string,
  take = 40,
  scope: OrderFormProductScope = 'all',
  merchantId?: string,
  merchantOrderMode?: 'consignment' | 'wholesale' | 'jar_exchange',
): Promise<OrderFormProductHit[]> {
  const rows = await findProductsForOrderForm(q, take, scope, merchantOrderMode);
  if (!merchantId || (scope !== 'merchant_standard' && scope !== 'merchant_jar_exchange')) {
    return rows.map((row) => toOrderFormProductHit(row));
  }

  if (scope === 'merchant_jar_exchange') {
    return rows.map((row) => toOrderFormProductHit(
      row,
      [],
      new Map(),
      new Map(),
      merchantId,
    ));
  }

  if (merchantOrderMode === 'wholesale') {
    const wholesalePrices = await loadMerchantWholesalePrices(merchantId);
    // 買斷價解析順序由表單與伺服器共用：店家特約 → 規格預設 → SKU 預設。
    return rows.map((row) => toOrderFormProductHit(
      row,
      wholesalePrices,
      new Map(),
      new Map(),
      merchantId,
    ));
  }

  const rules = await prisma.merchantProductRule.findMany({
    where: { merchantId, productId: { in: rows.map((row) => row.id) } },
    select: {
      productId: true,
      suggestedPrice: true,
      commissionMode: true,
      commissionValue: true,
    },
  });
  const suggestedPrices = new Map(rules.map((rule) => [rule.productId, rule.suggestedPrice]));
  const commissionRules = new Map(
    rules.map((rule) => [
      rule.productId,
      { mode: rule.commissionMode, value: rule.commissionValue },
    ]),
  );
  return rows.map((row) => toOrderFormProductHit(
    row,
    [],
    suggestedPrices,
    commissionRules,
    merchantId,
  ));
}

export async function getCustomersByIdsForOrderForm(
  ids: string[],
): Promise<OrderFormCustomerHit[]> {
  if (ids.length === 0) return [];
  return prisma.customer.findMany({
    where: { id: { in: ids } },
    select: customerSelect,
  });
}

export async function getProductsByIdsForOrderForm(
  ids: string[],
): Promise<OrderFormProductHit[]> {
  return getProductsByIdentitiesForOrderForm(ids, []);
}

/**
 * 複製歷史訂單時同時用商品 ID 與當時保存的 SKU 取回候選商品。
 * 舊資料的關聯 ID 可能已不再代表當時品項，因此 SKU 也必須納入。
 */
export async function getProductsByIdentitiesForOrderForm(
  ids: string[],
  skus: string[],
): Promise<OrderFormProductHit[]> {
  const normalizedIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const normalizedSkus = [...new Set(skus.map((sku) => sku.trim()).filter(Boolean))];
  if (normalizedIds.length === 0 && normalizedSkus.length === 0) return [];

  const rows = await prisma.product.findMany({
    where: {
      OR: [
        ...(normalizedIds.length > 0 ? [{ id: { in: normalizedIds } }] : []),
        ...normalizedSkus.map((sku) => ({ sku: { equals: sku, mode: 'insensitive' as const } })),
      ],
    },
    select: productSelect,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    sku: row.sku,
    productCategory: row.productCategory,
    availableStock: row.inventoryBalances.reduce((sum, balance) => sum + balance.quantity, 0),
    price: row.price,
    cost: row.cost,
    unit: row.unit,
    priceTiers: row.priceTiers,
    wholesalePrices: [],
    merchantSuggestedPrice: null,
    consignmentEnabled: row.consignmentEnabled,
    wholesaleEnabled: row.wholesaleEnabled,
    jarExchangeEnabled: row.jarExchangeEnabled,
    businessTier: row.businessTier,
    defaultConsignmentCommissionMode: row.defaultConsignmentCommissionMode,
    defaultConsignmentCommissionValue: row.defaultConsignmentCommissionValue,
    defaultWholesaleUnitPrice: row.defaultWholesaleUnitPrice,
    commercialTermsVersion: row.commercialTermsVersion,
    merchantCommissionMode: null,
    merchantCommissionValue: null,
    merchantCommercialContextId: null,
  }));
}
