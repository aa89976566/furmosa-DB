'use server';

import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { MerchantOrderMode } from '@/lib/orders/merchant-order-mode';

/** Only links to the existing copy flow, which resets payment and resolves current SKU pricing. */
export async function findLastMerchantOrder(merchantId: string, mode: MerchantOrderMode) {
  if (!(await getCurrentUser())) throw new Error('請先登入 HQ');
  if (!merchantId || !['consignment', 'wholesale', 'jar_exchange'].includes(mode)) return null;
  return prisma.order.findFirst({
    where: {
      merchantId,
      merchantOrderMode: mode,
      customerId: null,
      omsStatus: null,
      deletedAt: null,
      status: { notIn: ['cancelled', 'returned'] },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, orderNumber: true },
  });
}
