import { prisma } from '@/lib/prisma';
import { JarShell } from '@/components/jar-exchange/jar-shell';
import { JarExchangeAddMemberPanel } from '@/components/jar-exchange/add-member-panel';
import { JarMembersList } from '@/components/jar-exchange/jar-members-list';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function JarExchangeMembersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q ?? '').trim();

  const where = {
    services: {
      some: { serviceType: 'jar_exchange', serviceStatus: 'active' },
    },
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q, mode: 'insensitive' as const } },
            { customerId: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [customers, rewards] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        services: { where: { serviceStatus: 'active' } },
        pointsLedger: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: {
          select: {
            jarCodesRedeemed: { where: { status: 'used' } },
            rewardRedemptions: { where: { couponStatus: { not: 'cancelled' } } },
          },
        },
      },
      orderBy: { name: 'asc' },
      take: 200,
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
  ]);

  const rows = customers.map((c) => ({
    ...c,
    points: c.pointsLedger[0]?.balanceAfter ?? 0,
  }));

  return (
    <JarShell
      pathname="/jar-exchange/members"
      title="換罐會員"
      description="可同時擁有個人、訂閱、換罐等多種服務類型"
    >
      <JarExchangeAddMemberPanel />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜尋姓名、電話、編號…"
          className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm sm:h-9 sm:max-w-xs sm:flex-1"
        />
        <Button type="submit" size="sm" variant="outline" className="w-full sm:w-auto">
          搜尋
        </Button>
      </form>

      <JarMembersList rows={rows} rewards={rewards} />
    </JarShell>
  );
}
