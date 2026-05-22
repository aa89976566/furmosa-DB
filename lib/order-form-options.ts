import { prisma } from '@/lib/prisma';
import { withDbRetry } from '@/lib/prisma-retry';

export async function loadOrderFormOptions() {
  return withDbRetry(() =>
    Promise.all([
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
        orderBy: [{ hasActiveSubscription: 'desc' }, { name: 'asc' }],
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
        take: 500,
      }),
      prisma.product.findMany({
        where: { status: 'active' },
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          unit: true,
          priceTiers: {
            orderBy: [{ weightGrams: 'asc' }, { unitQty: 'asc' }],
            select: {
              id: true,
              weightGrams: true,
              unit: true,
              unitQty: true,
              price: true,
              notes: true,
            },
          },
        },
      }),
    ]),
  );
}
