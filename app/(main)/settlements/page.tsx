import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate, formatPercent } from '@/lib/format';
import { Store } from 'lucide-react';

const SETTLEMENT_STATUSES = ['draft', 'reviewing', 'approved', 'paid'] as const;

export const dynamic = 'force-dynamic';

export default async function SettlementsPage() {
  const [settlements, totals] = await Promise.all([
    prisma.settlement.findMany({
      include: { merchant: true },
      orderBy: [{ status: 'asc' }, { periodEnd: 'desc' }],
    }),
    prisma.settlement.groupBy({
      by: ['status'],
      _sum: { payable: true },
      _count: { _all: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="寄賣結算 Settlement"
        description="此處為全店結算總覽與稽核；試算與結清請至各店家詳情「期間結算」區塊完成（對齊業界依 consignor 產生 statement 的流程）"
        actions={
          <Button size="sm" asChild>
            <Link href="/merchants">
              <Store className="mr-1 h-4 w-4" />
              前往店家建立結算
            </Link>
          </Button>
        }
      />
      <div className="space-y-4 p-6">
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
              <p className="text-sm text-muted-foreground">尚無結算紀錄</p>
              <Button size="sm" asChild>
                <Link href="/merchants">
                  <Store className="mr-1 h-4 w-4" />
                  選擇店家並建立結算
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>結算編號</TableHead>
                <TableHead>店家</TableHead>
                <TableHead>期間</TableHead>
                <TableHead className="text-right">銷售額</TableHead>
                <TableHead className="text-right">分潤率</TableHead>
                <TableHead className="text-right">分潤金額</TableHead>
                <TableHead className="text-right">換罐補貼</TableHead>
                <TableHead className="text-right">應付</TableHead>
                <TableHead>狀態</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/settlements/${s.id}`} className="font-mono text-xs hover:underline">
                      {s.settlementId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/merchants/${s.merchant.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.merchant.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(s.periodStart)} ~ {formatDate(s.periodEnd)}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(s.grossSales))}</TableCell>
                  <TableCell className="text-right text-sm">
                    {formatPercent(Number(s.commissionRate), 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(s.commissionAmount))}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(Number(s.rewardPayout))}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatCurrency(Number(s.payable))}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="settlement" value={s.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/settlements/${s.id}`}>查看</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        )}
      </div>
    </>
  );
}
