import { prisma } from '@/lib/prisma';
import { taipeiLastNDaysRange } from '@/lib/taipei-date';
import {
  JAR_WEEK_ACTIVITY_DAYS,
  JAR_WEEK_ACTIVITY_SOURCE_TYPES,
  jarActivityStoreName,
  presentJarWeekActivity,
  type JarWeekActivityEntry,
  type JarWeekActivityView,
} from '@/lib/jar-exchange/week-activity';

export async function loadJarWeekActivity(reference = new Date()): Promise<JarWeekActivityView> {
  const range = taipeiLastNDaysRange(JAR_WEEK_ACTIVITY_DAYS, reference);
  const where = {
    createdAt: { gte: range.start, lte: range.end },
    sourceType: { in: [...JAR_WEEK_ACTIVITY_SOURCE_TYPES] },
  };

  const entries = await prisma.memberPointsLedger.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      createdAt: true,
      pointsChange: true,
      sourceType: true,
      sourceRefId: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });

  const jarIds = entries
    .filter((entry) => entry.sourceType === 'jar_code_redeem' && entry.sourceRefId)
    .map((entry) => entry.sourceRefId as string);
  const refillIds = entries
    .filter((entry) => entry.sourceType === 'refill_completed' && entry.sourceRefId)
    .map((entry) => entry.sourceRefId as string);

  const [jars, refills] = await Promise.all([
    jarIds.length
      ? prisma.jarCode.findMany({
          where: { id: { in: jarIds } },
          select: {
            id: true,
            returnedMerchant: { select: { name: true } },
            issuedMerchant: { select: { name: true } },
          },
        })
      : Promise.resolve([]),
    refillIds.length
      ? prisma.refillOrder.findMany({
          where: { id: { in: refillIds } },
          select: { id: true, merchant: { select: { name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const jarStores = new Map(jars.map((jar) => [jar.id, jar]));
  const refillStores = new Map(refills.map((order) => [order.id, order.merchant.name]));

  const activityEntries: JarWeekActivityEntry[] = entries.map((entry) => {
    const jar = entry.sourceRefId ? jarStores.get(entry.sourceRefId) : undefined;
    const storeName = jarActivityStoreName({
      sourceType: entry.sourceType,
      returnedMerchantName: jar?.returnedMerchant?.name,
      issuedMerchantName: jar?.issuedMerchant?.name,
      refillMerchantName: entry.sourceRefId ? refillStores.get(entry.sourceRefId) : null,
    });
    return {
      id: entry.id,
      createdAt: entry.createdAt,
      customerId: entry.customerId,
      memberName: entry.customer?.name ?? '',
      pointsChange: entry.pointsChange,
      sourceType: entry.sourceType,
      storeName,
    };
  });

  return presentJarWeekActivity(activityEntries, reference);
}
