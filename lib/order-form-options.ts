import { prisma } from '@/lib/prisma';
import {
  getCustomersByIdsForOrderForm,
  getProductsByIdsForOrderForm,
  searchCustomersForOrderForm,
  searchProductsForOrderForm,
  type OrderFormCustomerHit,
  type OrderFormProductHit,
} from '@/lib/order-form-search';
import { getMerchantTypesMap } from '@/lib/merchant-types-persist';
import type { MerchantType } from '@/lib/merchant-types';

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
  types: MerchantType[];
};

/**
 * 訂單表單初始資料：店家 + 少量客戶／商品種子。
 * ensure 已移出讀路徑（改 cron）；typeahead 負責其餘搜尋。
 */
export async function loadOrderFormOptions(seed?: {
  customerIds?: string[];
  productIds?: string[];
}): Promise<[OrderFormMerchantOption[], OrderFormCustomerHit[], OrderFormProductHit[]]> {
  const [merchants, seedCustomers, seedProducts, customerProducts, extraCustomers, extraProducts] =
    await Promise.all([
      prisma.merchant.findMany({
        where: { status: 'active' },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          merchantId: true,
          type: true,
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
      searchProductsForOrderForm('', 40, 'customer_standard'),
      getCustomersByIdsForOrderForm(seed?.customerIds ?? []),
      getProductsByIdsForOrderForm(seed?.productIds ?? []),
    ]);

  const customersById = new Map<string, OrderFormCustomerHit>();
  for (const c of [...extraCustomers, ...seedCustomers]) {
    customersById.set(c.id, c);
  }
  const productsById = new Map<string, OrderFormProductHit>();
  for (const p of [...extraProducts, ...customerProducts, ...seedProducts]) {
    productsById.set(p.id, p);
  }

  const typesByMerchant = await getMerchantTypesMap(prisma, merchants);
  const merchantOptions = merchants.map((merchant) => ({
    ...merchant,
    types: typesByMerchant.get(merchant.id) ?? ['consignment'],
  }));

  return [merchantOptions, [...customersById.values()], [...productsById.values()]];
}
