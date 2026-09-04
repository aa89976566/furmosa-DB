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
    notes: string | null;
  }[];
  wholesalePrices: MerchantWholesalePriceRow[];
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
): OrderFormProductHit {
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
  };
}

function findProductsForOrderForm(
  q: string,
  take: number,
  scope: OrderFormProductScope,
) {
  const term = q.trim();
  const search = term ? productSearchWhere(term) : undefined;

  return prisma.product.findMany({
    where: {
      status: 'active',
      ...orderFormProductScopeWhere(scope),
      ...(search ?? {}),
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
): Promise<OrderFormProductHit[]> {
  const rows = await findProductsForOrderForm(q, take, scope);
  if (scope !== 'merchant_standard' || !merchantId) {
    return rows.map((row) => toOrderFormProductHit(row));
  }

  const wholesalePrices = await loadMerchantWholesalePrices(merchantId);
  const configuredProductIds = new Set(wholesalePrices.map((price) => price.productId));
  return rows
    .filter((row) => configuredProductIds.has(row.id))
    .map((row) => toOrderFormProductHit(row, wholesalePrices));
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
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids } },
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
  }));
}
