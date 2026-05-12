import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime, formatNumber } from '@/lib/format';
import { pointSourceLabel } from '@/lib/labels';

const POINT_LEDGER_TYPES = ['earn', 'redeem', 'adjust', 'expire'] as const;

export const dynamic = 'force-dynamic';

export default async function PointsPage() {
  const [ledgers, totals] = await Promise.all([
    prisma.pointLedger.findMany({
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.pointLedger.groupBy({
      by: ['type'],
      _sum: { points: true },
      _count: { _all: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="點數帳本 Point Ledger"
        description="所有換罐會員的點數進出，含序號集點、贈點、兌換、過期"
      />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {POINT_LEDGER_TYPES.map((t) => {
            const row = totals.find((r) => r.type === t);
            return (
              <Card key={t}>
                <CardContent className="p-4">
                  <p className="text-xs">
                    <StatusBadge kind="point" value={t} />
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatNumber(row?._sum.points ?? 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">{row?._count._all ?? 0} 筆</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          {ledgers.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              尚無點數紀錄。會員可在官網輸入序號集點，或下單後自動贈點。
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>會員</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>來源</TableHead>
                  <TableHead className="text-right">點數</TableHead>
                  <TableHead className="text-right">餘額</TableHead>
                  <TableHead>關聯</TableHead>
                  <TableHead>時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgers.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link
                        href={`/customers/${p.customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {p.customer.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {p.customer.loyaltyMemberId ?? p.customer.customerId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="point" value={p.type} />
                    </TableCell>
                    <TableCell className="text-sm">{pointSourceLabel[p.source]}</TableCell>
                    <TableCell
                      className={`text-right font-semibold ${p.points >= 0 ? 'text-success' : 'text-info'}`}
                    >
                      {p.points > 0 ? '+' : ''}
                      {p.points}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {p.balanceAfter}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.reference ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(p.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
