import type { Prisma } from '@prisma/client';
import type { CustomerServiceType } from '@/lib/jar-exchange/constants';

type Db = Prisma.TransactionClient | typeof import('@/lib/prisma').prisma;

/** 依客戶現況同步 personal / subscription 服務列（jar_exchange 僅手動或兌換時開通） */
export async function syncCustomerServices(db: Db, customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { type: true, hasActiveSubscription: true },
  });
  if (!customer) return;

  const upsert = async (
    serviceType: CustomerServiceType,
    active: boolean,
    notes?: string,
  ) => {
    const existing = await db.customerService.findUnique({
      where: { customerId_serviceType: { customerId, serviceType } },
    });
    if (active) {
      if (existing) {
        if (existing.serviceStatus !== 'active') {
          await db.customerService.update({
            where: { id: existing.id },
            data: { serviceStatus: 'active', endedAt: null },
          });
        }
      } else {
        await db.customerService.create({
          data: {
            customerId,
            serviceType,
            serviceStatus: 'active',
            notes: notes ?? null,
          },
        });
      }
    } else if (existing && existing.serviceStatus === 'active') {
      await db.customerService.update({
        where: { id: existing.id },
        data: { serviceStatus: 'closed', endedAt: new Date() },
      });
    }
  };

  await upsert('personal', customer.type === 'individual', '個人客戶');
  await upsert(
    'subscription',
    customer.hasActiveSubscription,
    '訂閱合約進行中',
  );
}

export async function ensureJarExchangeService(db: Db, customerId: string) {
  const existing = await db.customerService.findUnique({
    where: { customerId_serviceType: { customerId, serviceType: 'jar_exchange' } },
  });
  if (existing) {
    if (existing.serviceStatus !== 'active') {
      await db.customerService.update({
        where: { id: existing.id },
        data: { serviceStatus: 'active', endedAt: null },
      });
    }
    return existing;
  }
  return db.customerService.create({
    data: {
      customerId,
      serviceType: 'jar_exchange',
      serviceStatus: 'active',
      notes: '換罐返航',
    },
  });
}
