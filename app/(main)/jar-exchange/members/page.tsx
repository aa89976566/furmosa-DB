import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { JarShell, JarPanel } from '@/components/jar-exchange/jar-shell';
import { JarExchangeAddMemberPanel } from '@/components/jar-exchange/add-member-panel';
import { JarMemberRedeemMenu } from '@/components/jar-exchange/jar-member-redeem-menu';
import { JarSignupLiveRefresh } from '@/components/jar-exchange/jar-signup-live-refresh';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { formatGroomingCouponDiscountForStore } from '@/lib/coupons/constants';
import { resolvePetSpeciesLabel } from '@/lib/customers/pet-fields';
import { customerServiceTypeLabel } from '@/lib/jar-exchange/labels';
import { resolveSignupStoreLabel } from '@/lib/line/line-copy';

export const dynamic = 'force-dynamic';

export default async function JarExchangeMembersPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const q = (searchParams?.q ?? '').trim();

  const customerFilter = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q, mode: 'insensitive' as const } },
          { customerId: { contains: q, mode: 'insensitive' as const } },
          { petName: { contains: q, mode: 'insensitive' as const } },
          { lineDisplay: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [serviceRows, rewards] = await Promise.all([
    prisma.customerService.findMany({
      where: {
        serviceType: 'jar_exchange',
        serviceStatus: 'active',
        customer: customerFilter,
      },
      orderBy: { startedAt: 'desc' },
      take: 200,
      include: {
        customer: {
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
        },
      },
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

  const rows = serviceRows.map((svc) => {
    const c = svc.customer;
    const petSpecies = resolvePetSpeciesLabel(c.petSpecies, c.petSpeciesOther);
    return {
      ...c,
      jarStartedAt: svc.startedAt,
      points: c.pointsLedger[0]?.balanceAfter ?? 0,
      petLabel:
        c.petName || petSpecies
          ? [petSpecies, c.petName].filter(Boolean).join(' · ')
          : null,
    };
  });

  return (
    <JarShell
      pathname="/jar-exchange/members"
      title="換罐會員"
      description="LINE 開戶會同步進這裡。列表依開通時間新→舊，方便對帳今日註冊。"
    >
      <JarExchangeAddMemberPanel />

      <div className="mb-4 space-y-3">
        <JarSignupLiveRefresh />
        <form className="flex gap-2" method="get">
          <input
            name="q"
            defaultValue={q}
            placeholder="搜尋姓名、電話、毛孩、LINE、編號…"
            className="h-10 max-w-md flex-1 rounded-xl border border-input bg-card px-3 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" className="h-10 rounded-xl">
            搜尋
          </Button>
        </form>
      </div>

      <JarPanel>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">會員 · 毛孩</th>
                <th className="px-4 py-3 font-medium">LINE / 電話</th>
                <th className="px-4 py-3 font-medium">開戶店家</th>
                <th className="px-4 py-3 font-medium">開通時間</th>
                <th className="px-4 py-3 font-medium">服務</th>
                <th className="px-4 py-3 font-medium text-right">點數</th>
                <th className="px-4 py-3 font-medium text-right">序號</th>
                <th className="px-4 py-3 font-medium text-right">獎勵</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-navy">{c.name}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {c.customerId}
                    </div>
                    {c.petLabel ? (
                      <div className="mt-1 text-xs text-muted-foreground">{c.petLabel}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {c.lineUserId ? (
                      <Badge variant="info" className="mb-1 text-[10px]">
                        LINE{c.lineDisplay ? ` · ${c.lineDisplay}` : ''}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="mb-1 text-[10px]">
                        無 LINE
                      </Badge>
                    )}
                    <div className="text-muted-foreground">{c.phone ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {c.signupStore || c.storeId ? (
                      <div>
                        <div>
                          {resolveSignupStoreLabel(c.signupStore ?? c.storeId) ?? '—'}
                        </div>
                        <div className="mt-0.5 text-xs tabular-nums">
                          {formatGroomingCouponDiscountForStore(
                            c.storeId ?? c.signupStore ?? '',
                            c.storeName ??
                              resolveSignupStoreLabel(c.signupStore ?? c.storeId),
                          )}
                        </div>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    <div className="font-medium text-foreground">
                      {formatRelative(c.jarStartedAt)}
                    </div>
                    <div className="tabular-nums">{formatDateTime(c.jarStartedAt)}</div>
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
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatNumber(c.points)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c._count.jarCodesRedeemed}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {c._count.rewardRedemptions}
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
                    {q
                      ? '找不到符合的會員'
                      : '尚無換罐會員；LINE「幫毛孩開戶」完成後會出現在此'}
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
