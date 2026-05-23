import { Suspense } from 'react';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MerchantWorkspace } from '@/components/merchants/merchant-ui';
import { SectionCard } from '@/components/shared/section-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { SettlementFilterLinks } from '@/components/settlements/settlement-filter-links';
import { SettlementsViewTabs } from '@/components/settlements/settlements-view-tabs';
import { SettlementCreatePanel } from '@/components/settlements/settlement-create-panel';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import {
  buildSettlementWhere,
  parseSettlementListSearchParams,
  SETTLEMENT_STATUSES,
} from '@/lib/settlement-list-query';
import { formatTaipeiMonthLabel } from '@/lib/taipei-date';
import { listMerchantsForSelect, resolveSelectedMerchantId } from '@/lib/merchant-operation-options';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

function pickParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
) {
  const v = searchParams[key];
  return typeof v === 'string' ? v : undefined;
}

export default async function MerchantsSettlementsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const isCreateView = pickParam(searchParams, 'view') === 'create';
  const filters = parseSettlementListSearchParams(searchParams);
  const where = buildSettlementWhere(filters);

  const merchantsForSelect = await listMerchantsForSelect();
  const createMerchantId = resolveSelectedMerchantId(
    merchantsForSelect,
    pickParam(searchParams, 'merchantId'),
  );

  const settlementParams = {
    settle_from: pickParam(searchParams, 'settle_from'),
    settle_to: pickParam(searchParams, 'settle_to'),
    settle_shipping: pickParam(searchParams, 'settle_shipping'),
    settle_reward: pickParam(searchParams, 'settle_reward'),
  };

  const [settlements, totals, merchants, periodSummary] = await Promise.all([
    prisma.settlement.findMany({
      where,
      include: { merchant: true },
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.settlement.groupBy({
      by: ['status'],
      where,
      _sum: { payable: true, grossSales: true },
      _count: { _all: true },
    }),
    prisma.merchant.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    filters.month
      ? prisma.settlement.aggregate({
          where,
          _sum: {
            grossSales: true,
            commissionAmount: true,
            payable: true,
            merchantOwesUs: true,
          },
          _count: { _all: true },
        })
      : null,
  ]);

  const monthLabel = filters.month ? formatTaipeiMonthLabel(filters.month) : null;

  return (
    <MerchantWorkspace>
      <Suspense fallback={<div className="h-9" />}>
        <SettlementsViewTabs />
      </Suspense>

      {isCreateView ? (
        <SectionCard
          title="建立月結"
          description="依期間彙總未結清銷售流水，試算後可產生結算單並鎖定銷售紀錄"
        >
          <SettlementCreatePanel
            merchants={merchantsForSelect}
            selectedMerchantId={createMerchantId}
            searchParams={settlementParams}
          />
        </SectionCard>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              各店期間結算單總覽；草稿可審核、核准至撥款完成
            </p>
            <Button size="sm" asChild>
              <Link href="/merchants/settlements?view=create">
                <Plus className="mr-1 h-4 w-4" />
                建立月結
              </Link>
            </Button>
          </div>

          <SettlementFilterLinks filters={filters} merchants={merchants} />

          {monthLabel && periodSummary && (
            <Card>
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">{monthLabel} 結算筆數</p>
                  <p className="text-2xl font-semibold tabular-nums">{periodSummary._count._all}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">銷售額合計</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(Number(periodSummary._sum.grossSales ?? 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">分潤合計</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(Number(periodSummary._sum.commissionAmount ?? 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">應付店家合計</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {formatCurrency(Number(periodSummary._sum.payable ?? 0))}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {SETTLEMENT_STATUSES.map((s) => {
              const row = totals.find((t) => t.status === s);
              return (
                <Card key={s}>
                  <CardContent className="p-4">
                    <p className="text-xs">
                      <StatusBadge kind="settlement" value={s} />
                    </p>
                    <p className="mt-1 text-xl font-semibold">
                      {formatCurrency(Number(row?._sum.payable ?? 0))}
                    </p>
                    <p className="text-xs text-muted-foreground">{row?._count._all ?? 0} 筆</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {settlements.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <p className="text-sm text-muted-foreground">
                  {filters.month || filters.status || filters.merchantId
                    ? '此篩選條件下尚無月結紀錄'
                    : '尚無月結紀錄'}
                </p>
                <Button size="sm" asChild>
                  <Link href="/merchants/settlements?view=create">
                    <Plus className="mr-1 h-4 w-4" />
                    建立第一筆月結
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <p className="border-b px-4 py-2 text-xs text-muted-foreground">
                共 {settlements.length} 筆
                {monthLabel ? `（期間與 ${monthLabel} 有交集）` : ''}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>結算編號</TableHead>
                    <TableHead>店家</TableHead>
                    <TableHead>結算期間</TableHead>
                    <TableHead className="text-right">銷售額</TableHead>
                    <TableHead className="text-right">分潤率</TableHead>
                    <TableHead className="text-right">分潤金額</TableHead>
                    <TableHead className="text-right">換罐補貼</TableHead>
                    <TableHead className="text-right">應付店家</TableHead>
                    <TableHead className="text-right">店家應返</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Link
                          href={`/merchants/settlements/${s.id}`}
                          className="font-mono text-xs hover:underline"
                        >
                          {s.settlementId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/merchants/${s.merchant.id}/settlement`}
                          className="font-medium hover:underline"
                        >
                          {s.merchant.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(s.grossSales))}
                      </TableCell>
                      <TableCell className="text-right text-sm tabular-nums">
                        {formatPercent(Number(s.commissionRate), 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(s.commissionAmount))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(s.rewardPayout))}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(Number(s.payable))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(s.merchantOwesUs))}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="settlement" value={s.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/merchants/settlements/${s.id}`}>查看</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}
    </MerchantWorkspace>
  );
}
