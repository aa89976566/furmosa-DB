import { prisma } from '@/lib/prisma';
import { customerSearchWhere, productSearchWhere } from '@/lib/site-search';

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
  price: true,
  cost: true,
  unit: true,
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
): Promise<OrderFormProductHit[]> {
  const term = q.trim();
  const search = term ? productSearchWhere(term) : undefined;

  return prisma.product.findMany({
    where: {
      status: 'active',
      ...(search ?? {}),
    },
    orderBy: { name: 'asc' },
    select: productSelect,
    take,
  });
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
  return prisma.product.findMany({
    where: { id: { in: ids } },
    select: productSelect,
  });
}
