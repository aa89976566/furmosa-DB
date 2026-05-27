import { prisma } from '@/lib/prisma';

export async function getJarExchangeStatsForCustomer(customerId: string) {
  const [balance, codesUsed, rewardsRedeemed, lastLedger, jarService] = await Promise.all([
    prisma.memberPointsLedger
      .findFirst({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        select: { balanceAfter: true },
      })
      .then((r) => r?.balanceAfter ?? 0),
    prisma.jarCode.count({
      where: { redeemedByCustomerId: customerId, status: 'used' },
    }),
    prisma.rewardRedemption.count({
      where: { customerId, couponStatus: { not: 'cancelled' } },
    }),
    prisma.memberPointsLedger.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.customerService.findUnique({
      where: { customerId_serviceType: { customerId, serviceType: 'jar_exchange' } },
    }),
  ]);

  return {
    pointsBalance: balance,
    codesRedeemed: codesUsed,
    rewardsRedeemed,
    lastActivityAt: lastLedger?.createdAt ?? null,
    jarServiceStatus: jarService?.serviceStatus ?? null,
  };
}

export async function getMonthJarExchangeKpis() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [pointsIssued, groomingCost] = await Promise.all([
    prisma.memberPointsLedger.aggregate({
      _sum: { pointsChange: true },
      where: {
        createdAt: { gte: startOfMonth },
        sourceType: 'jar_code_redeem',
        pointsChange: { gt: 0 },
      },
    }),
    prisma.marketingCostRecord.aggregate({
      _sum: { amount: true },
      where: {
        bookedAt: { gte: startOfMonth },
        costCategory: 'jar_return_program',
        paymentStatus: { not: 'void' },
      },
    }),
  ]);

  return {
    monthJarPointsIssued: Number(pointsIssued._sum.pointsChange ?? 0),
    monthGroomingCouponCost: Number(groomingCost._sum.amount ?? 0),
  };
}
