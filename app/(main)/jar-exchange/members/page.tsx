import { prisma } from '@/lib/prisma';
import { JarShell } from '@/components/jar-exchange/jar-shell';
import { JarExchangeAddMemberPanel } from '@/components/jar-exchange/add-member-panel';
import {
  JarMemberWorkspace,
  type JarMemberWorkspaceRow,
  type JarMessageLogRow,
} from '@/components/jar-exchange/jar-member-workspace';
import { resolveSignupStoreLabel } from '@/lib/line/line-copy';
import {
  isTestJarMember,
  JAR_LINE_CAMPAIGN_RECIPIENT_ENTITY,
  JAR_LINE_CAMPAIGN_RUN_ENTITY,
} from '@/lib/jar-exchange/member-campaign';

export const dynamic = 'force-dynamic';

export default async function JarExchangeMembersPage() {
  const [customers, rewards, campaignLogs] = await Promise.all([
    prisma.customer.findMany({
      where: { services: { some: { serviceType: 'jar_exchange' } } },
      include: {
        services: { where: { serviceType: 'jar_exchange' }, take: 1 },
        pointsLedger: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            jarCodesRedeemed: { where: { status: 'used' } },
            rewardRedemptions: { where: { couponStatus: { not: 'cancelled' } } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 500,
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
    prisma.statusAuditLog.findMany({
      where: { entityType: JAR_LINE_CAMPAIGN_RUN_ENTITY },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);

  const customerIds = customers.map((customer) => customer.id);
  const lineUserIds = customers.flatMap((customer) => customer.lineUserId ? [customer.lineUserId] : []);
  const [reminderLogs, exchangeLogs] = await Promise.all([
    prisma.statusAuditLog.findMany({
        where: {
          newStatus: 'sent',
          OR: [
            { entityType: JAR_LINE_CAMPAIGN_RECIPIENT_ENTITY, entityId: { in: customerIds } },
            { entityType: 'jar-return-reminder-2026-08-28', entityId: { in: lineUserIds } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { entityType: true, entityId: true, createdAt: true },
    }),
    prisma.memberPointsLedger.findMany({
      where: {
        customerId: { in: customerIds },
        sourceType: { in: ['jar_code_redeem', 'refill_completed'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { customerId: true, createdAt: true },
    }),
  ]);

  const customerIdByLineUserId = new Map(
    customers.flatMap((customer) => customer.lineUserId ? [[customer.lineUserId, customer.id] as const] : []),
  );
  const lastReminderByCustomerId = new Map<string, Date>();
  for (const log of reminderLogs) {
    const customerId = log.entityType === JAR_LINE_CAMPAIGN_RECIPIENT_ENTITY
      ? log.entityId
      : customerIdByLineUserId.get(log.entityId);
    if (customerId && !lastReminderByCustomerId.has(customerId)) {
      lastReminderByCustomerId.set(customerId, log.createdAt);
    }
  }
  const lastExchangeByCustomerId = new Map<string, Date>();
  for (const log of exchangeLogs) {
    if (!lastExchangeByCustomerId.has(log.customerId)) {
      lastExchangeByCustomerId.set(log.customerId, log.createdAt);
    }
  }

  const rows: JarMemberWorkspaceRow[] = customers.map((customer) => ({
    id: customer.id,
    customerId: customer.customerId,
    name: customer.name,
    phone: customer.phone,
    storeLabel: resolveSignupStoreLabel(customer.signupStore ?? customer.storeId) ?? customer.storeName ?? '—',
    serviceStatus: customer.services[0]?.serviceStatus ?? 'closed',
    lineLinked: Boolean(customer.lineUserId),
    points: customer.pointsLedger[0]?.balanceAfter ?? 0,
    redeemedCount: customer._count.jarCodesRedeemed,
    rewardCount: customer._count.rewardRedemptions,
    lastExchangeAt: lastExchangeByCustomerId.get(customer.id)?.toISOString() ?? null,
    lastReminderAt: lastReminderByCustomerId.get(customer.id)?.toISOString() ?? null,
    isTest: isTestJarMember(customer),
  }));

  const messageLogs = campaignLogs.flatMap((log): JarMessageLogRow[] => {
    try {
      const metadata = JSON.parse(log.metadataJson ?? '{}') as Record<string, unknown>;
      return [{
        id: log.id,
        createdAt: log.createdAt.toISOString(),
        campaignName: String(metadata.campaignName ?? '未命名活動'),
        audienceConditions: String(metadata.audienceConditions ?? ''),
        exclusionConditions: String(metadata.exclusionConditions ?? ''),
        message: String(metadata.message ?? ''),
        preventDuplicates: Boolean(metadata.preventDuplicates),
        selectedCount: Number(metadata.selectedCount ?? 0),
        sent: Number(metadata.sent ?? 0),
        skipped: Number(metadata.skipped ?? 0),
        failed: Number(metadata.failed ?? 0),
      }];
    } catch {
      return [];
    }
  });

  return (
    <JarShell pathname="/jar-exchange/members" title="換罐會員" description="可同時擁有個人、訂閱、換罐等多種服務類型">
      <JarExchangeAddMemberPanel />
      <JarMemberWorkspace rows={rows} rewards={rewards} messageLogs={messageLogs} />
    </JarShell>
  );
}
