import { prisma } from '@/lib/prisma';
import { syncCustomerServices } from '@/lib/jar-exchange/services';
import { getJarExchangeStatsForCustomer } from '@/lib/jar-exchange/stats';
import { CUSTOMER_OPEN_REFILL_STATUSES } from '@/lib/customers/customer-crm-labels';
import { summarizeMemberPoints } from '@/lib/customers/member-points-summary';

export async function loadCustomerDetail(customerId: string) {
  await syncCustomerServices(prisma, customerId);

  const [
    customer,
    issuedJars,
    recentAppointments,
    openRefillOrders,
    recentPointsLedger,
    draftOrderCount,
    earnedPointsAggregate,
    redeemedPointsAggregate,
    recentRedeemedCodes,
    usedCodeCount,
    availableCouponCount,
  ] = await Promise.all([
    prisma.customer.findUnique({
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
    }),
    prisma.jarCode.findMany({
      where: {
        redeemedByCustomerId: customerId,
        status: 'issued',
      },
      orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
      take: 20,
      select: {
        id: true,
        code: true,
        status: true,
        issuedAt: true,
        createdAt: true,
        issuedMerchant: { select: { id: true, name: true } },
        lockedByRefillOrderId: true,
      },
    }),
    prisma.appointment.findMany({
      where: { customerId },
      orderBy: { startsAt: 'desc' },
      take: 5,
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        status: true,
        serviceName: true,
        petName: true,
        merchant: { select: { id: true, name: true } },
      },
    }),
    prisma.refillOrder.findMany({
      where: {
        customerId,
        status: { in: [...CUSTOMER_OPEN_REFILL_STATUSES] },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        orderType: true,
        status: true,
        baseAmount: true,
        extraAmount: true,
        totalAmount: true,
        createdAt: true,
        oldContainerSerial: true,
        newContainerSerial: true,
        missingContainerNote: true,
        deliveryMode: true,
        merchant: { select: { id: true, name: true } },
        appointment: {
          select: {
            id: true,
            startsAt: true,
            serviceName: true,
            petName: true,
          },
        },
        product: { select: { id: true, name: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          select: {
            id: true,
            purpose: true,
            amount: true,
            status: true,
            paidAt: true,
            merchantTradeNo: true,
          },
        },
      },
    }),
    prisma.memberPointsLedger.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        pointsChange: true,
        balanceAfter: true,
        sourceType: true,
        sourceRefId: true,
        note: true,
        createdAt: true,
      },
    }),
    prisma.order.count({
      where: { customerId, status: 'draft' },
    }),
    prisma.memberPointsLedger.aggregate({
      where: { customerId, pointsChange: { gt: 0 } },
      _sum: { pointsChange: true },
    }),
    prisma.memberPointsLedger.aggregate({
      where: {
        customerId,
        sourceType: 'reward_redemption',
        pointsChange: { lt: 0 },
      },
      _sum: { pointsChange: true },
    }),
    prisma.jarCode.findMany({
      where: { redeemedByCustomerId: customerId, status: 'used' },
      orderBy: { redeemedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        code: true,
        pointValue: true,
        batchNo: true,
        redeemedAt: true,
      },
    }),
    prisma.jarCode.count({
      where: { redeemedByCustomerId: customerId, status: 'used' },
    }),
    prisma.rewardRedemption.count({
      where: { customerId, couponStatus: 'issued' },
    }),
  ]);

  if (!customer) return null;

  const hasJar = customer.services.some(
    (s) => s.serviceType === 'jar_exchange' && s.serviceStatus === 'active',
  );

  const jarPromise = hasJar
    ? Promise.all([
        getJarExchangeStatsForCustomer(customer.id),
        prisma.rewardRedemption.findMany({
          where: { customerId: customer.id },
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

  const pointsBalance =
    jar?.stats.pointsBalance ??
    recentPointsLedger[0]?.balanceAfter ??
    0;

  const pointsTotals = summarizeMemberPoints({
    earnedPointsChange: earnedPointsAggregate._sum.pointsChange,
    redeemedPointsChange: redeemedPointsAggregate._sum.pointsChange,
  });

  return {
    customer,
    hasJar,
    jar,
    issuedJars,
    recentAppointments,
    openRefillOrders,
    recentPointsLedger,
    pointsBalance,
    draftOrderCount,
    pointsTotals,
    recentRedeemedCodes,
    usedCodeCount,
    availableCouponCount,
  };
}

export type CustomerDetailData = NonNullable<Awaited<ReturnType<typeof loadCustomerDetail>>>;
