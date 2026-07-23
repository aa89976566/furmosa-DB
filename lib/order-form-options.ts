import { prisma } from '@/lib/prisma';
import { withDbRetry } from '@/lib/prisma-retry';
import { ensureZhuwoConsignmentBranches } from '@/lib/stores/ensure-zhuwo-merchants';
import { ensureQimuDeliveryShipping } from '@/lib/stores/ensure-qimu-delivery';
import { runThrottled } from '@/lib/job-throttle';
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
 * 訂單表單初始資料：店家全量（通常不多）+ 少量客戶／商品種子。
 * 其餘靠 typeahead Server Action 載入。
 */
export async function loadOrderFormOptions(seed?: {
  customerIds?: string[];
  productIds?: string[];
}): Promise<[OrderFormMerchantOption[], OrderFormCustomerHit[], OrderFormProductHit[]]> {
  return withDbRetry(async () => {
    await runThrottled('ensureZhuwoConsignmentBranches', () => ensureZhuwoConsignmentBranches());
    await runThrottled('ensureQimuDeliveryShipping', () => ensureQimuDeliveryShipping());

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

    return [
      merchants,
      [...customersById.values()],
      [...productsById.values()],
    ];
  });
}
