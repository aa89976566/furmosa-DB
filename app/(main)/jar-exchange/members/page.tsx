import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { JarShell, JarPanel } from '@/components/jar-exchange/jar-shell';
import { JarExchangeAddMemberPanel } from '@/components/jar-exchange/add-member-panel';
import { JarReturnReminder20260828Panel } from '@/components/jar-exchange/jar-return-reminder-20260828-panel';
import { JarMemberRedeemMenu } from '@/components/jar-exchange/jar-member-redeem-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatNumber } from '@/lib/format';
import { formatGroomingCouponDiscountForStore } from '@/lib/coupons/constants';
import { customerServiceTypeLabel } from '@/lib/jar-exchange/labels';
import { resolveSignupStoreLabel } from '@/lib/line/line-copy';

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

  const [customers, rewards, reminderCandidatesRaw] = await Promise.all([
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
    prisma.customer.findMany({
      where: {
        services: {
          some: { serviceType: 'jar_exchange', serviceStatus: 'active' },
        },
        lineUserId: { not: null },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  const rows = customers.map((c) => ({
    ...c,
    points: c.pointsLedger[0]?.balanceAfter ?? 0,
  }));
  const reminderCandidates = reminderCandidatesRaw
    .filter((customer) => customer.name.trim().toLowerCase() !== 'test')
    .map((customer) => ({ id: customer.id, name: customer.name }));

  return (
    <JarShell pathname="/jar-exchange/members" title="換罐會員" description="可同時擁有個人、訂閱、換罐等多種服務類型">
      <JarExchangeAddMemberPanel />
      <JarReturnReminder20260828Panel candidates={reminderCandidates} />

      <form className="mb-4 flex gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="搜尋姓名、電話、編號…"
          className="h-9 max-w-xs flex-1 rounded-xl border border-input bg-card px-3 text-sm"
        />
        <Button type="submit" size="sm" variant="outline">
          搜尋
        </Button>
      </form>

      <JarPanel>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">會員</th>
                <th className="px-4 py-3 font-medium">聯絡</th>
                <th className="px-4 py-3 font-medium">開戶店家 · 折價券</th>
                <th className="px-4 py-3 font-medium">服務類型</th>
                <th className="px-4 py-3 font-medium text-right">點數</th>
                <th className="px-4 py-3 font-medium text-right">已兌序號</th>
                <th className="px-4 py-3 font-medium text-right">已兌獎勵</th>
                <th className="px-4 py-3 font-medium">最近活動</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{c.customerId}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.signupStore || c.storeId ? (
                      <div>
                        <div>{resolveSignupStoreLabel(c.signupStore ?? c.storeId) ?? '—'}</div>
                        <div className="mt-0.5 text-xs tabular-nums">
                          {formatGroomingCouponDiscountForStore(
                            c.storeId ?? c.signupStore ?? '',
                            c.storeName ?? resolveSignupStoreLabel(c.signupStore ?? c.storeId),
                          )}
                        </div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.services.map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-[10px]">
                          {customerServiceTypeLabel[s.serviceType] ?? s.serviceType}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatNumber(c.points)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c._count.jarCodesRedeemed}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c._count.rewardRedemptions}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.pointsLedger[0]
                      ? formatDateTime(c.pointsLedger[0].createdAt)
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <JarMemberRedeemMenu
                        customerId={c.id}
                        customerName={c.name}
                        pointsBalance={c.points}
                        rewards={rewards}
                      />
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/customers/${c.id}`}>詳情</Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    尚無換罐會員，請使用上方「新增換罐會員」加入
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </JarPanel>
    </JarShell>
  );
}
