import { prisma } from '@/lib/prisma';
import { syncCustomerServices } from '@/lib/jar-exchange/services';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';

export async function loadCustomerDetail(customerId: string) {
  await syncCustomerServices(prisma, customerId);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      services: { orderBy: { serviceType: 'asc' } },
      orders: {
        orderBy: { orderedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          source: true,
          status: true,
          total: true,
          orderedAt: true,
        },
      },
      subscriptions: {
        select: {
          id: true,
          subscriptionNo: true,
          status: true,
          plan: { select: { name: true } },
        },
        orderBy: [{ status: 'asc' }, { startDate: 'desc' }],
        take: 5,
      },
      _count: {
        select: {
          orders: true,
          subscriptions: true,
          pointsLedger: true,
          rewardRedemptions: true,
          jarCodesRedeemed: true,
        },
      },
    },
  });

  if (!customer) return null;

  const hasJar = customer.services.some(
    (s) => s.serviceType === 'jar_exchange' && s.serviceStatus === 'active',
  );

  const jarPromise = hasJar
    ? Promise.all([
        getJarExchangeStatsForCustomer(customer.id),
        prisma.rewardRedemption.findMany({
          where: { customerId: customer.id, couponStatus: { not: 'cancelled' } },
          include: {
            reward: {
              select: {
                rewardName: true,
                couponFaceValue: true,
                pointsRequired: true,
              },
            },
          },
          orderBy: { issuedAt: 'desc' },
          take: 5,
        }),
        prisma.rewardCatalog.findMany({
          where: {
            activeStatus: 'active',
            AND: [
              { OR: [{ startAt: null }, { startAt: { lte: new Date() } }] },
              { OR: [{ endAt: null }, { endAt: { gte: new Date() } }] },
            ],
          },
          orderBy: [{ sortOrder: 'asc' }, { pointsRequired: 'asc' }],
          select: {
            id: true,
            rewardName: true,
            pointsRequired: true,
            couponFaceValue: true,
          },
        }),
      ])
    : null;

  const jar = jarPromise
    ? {
        stats: (await jarPromise)[0],
        redemptions: (await jarPromise)[1],
        rewardOptions: (await jarPromise)[2],
        ledgerCount: customer._count.pointsLedger,
        redemptionCount: customer._count.rewardRedemptions,
        jarCodesCount: customer._count.jarCodesRedeemed,
      }
    : null;

  return { customer, hasJar, jar };
}

export type CustomerDetailData = NonNullable<Awaited<ReturnType<typeof loadCustomerDetail>>>;
