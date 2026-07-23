import { prisma } from '@/lib/prisma';
import {
  getCustomersByIdsForOrderForm,
  getProductsByIdsForOrderForm,
  searchCustomersForOrderForm,
  searchProductsForOrderForm,
  type OrderFormCustomerHit,
  type OrderFormProductHit,
} from '@/lib/order-form-search';

export type OrderFormMerchantOption = {
  id: string;
  name: string;
  merchantId: string;
  contactName: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  preferredCarrier: string | null;
  pickupStoreName: string | null;
};

/**
 * 訂單表單初始資料：店家 + 少量客戶／商品種子。
 * ensure 已移出讀路徑（改 cron）；typeahead 負責其餘搜尋。
 */
export async function loadOrderFormOptions(seed?: {
  customerIds?: string[];
  productIds?: string[];
}): Promise<[OrderFormMerchantOption[], OrderFormCustomerHit[], OrderFormProductHit[]]> {
  const [merchants, seedCustomers, seedProducts, extraCustomers, extraProducts] =
    await Promise.all([
      prisma.merchant.findMany({
        where: { status: 'active' },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          merchantId: true,
          contactName: true,
          phone: true,
          address: true,
          city: true,
          preferredCarrier: true,
          pickupStoreName: true,
        },
      }),
      searchCustomersForOrderForm('', 24),
      searchProductsForOrderForm('', 40),
      getCustomersByIdsForOrderForm(seed?.customerIds ?? []),
      getProductsByIdsForOrderForm(seed?.productIds ?? []),
    ]);

  const customersById = new Map<string, OrderFormCustomerHit>();
  for (const c of [...extraCustomers, ...seedCustomers]) {
    customersById.set(c.id, c);
  }
  const productsById = new Map<string, OrderFormProductHit>();
  for (const p of [...extraProducts, ...seedProducts]) {
    productsById.set(p.id, p);
  }

  return [merchants, [...customersById.values()], [...productsById.values()]];
}
