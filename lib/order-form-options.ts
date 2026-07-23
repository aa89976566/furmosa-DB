import { prisma } from '@/lib/prisma';
import { withDbRetry } from '@/lib/prisma-retry';
import { ensureZhuwoConsignmentBranches } from '@/lib/stores/ensure-zhuwo-merchants';
import { ensureQimuDeliveryShipping } from '@/lib/stores/ensure-qimu-delivery';
import { runThrottled } from '@/lib/job-throttle';

export async function loadOrderFormOptions() {
  return withDbRetry(async () => {
    await runThrottled('ensureZhuwoConsignmentBranches', () => ensureZhuwoConsignmentBranches());
    await runThrottled('ensureQimuDeliveryShipping', () => ensureQimuDeliveryShipping());
    return Promise.all([
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
      prisma.customer.findMany({
        orderBy: [{ hasActiveSubscription: 'desc' }, { lastOrderAt: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          customerId: true,
          phone: true,
          address: true,
          preferredShippingMethod: true,
          preferredCvsBrand: true,
          preferredCvsStoreId: true,
          preferredCvsStoreName: true,
        },
        take: 80,
      }),
      prisma.product.findMany({
        where: { status: 'active' },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          cost: true,
          unit: true,
          priceTiers: {
            orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }],
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
        },
        take: 300,
      }),
    ]);
  });
}
