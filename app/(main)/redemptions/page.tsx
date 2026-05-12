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
import { formatCurrency, formatDateTime } from '@/lib/format';

const REDEMPTION_STATUSES = ['pending', 'fulfilled', 'cancelled'] as const;

export const dynamic = 'force-dynamic';

export default async function RedemptionsPage() {
  const [redemptions, totals] = await Promise.all([
    prisma.redemption.findMany({
      include: { customer: true, reward: true, payoutMerchant: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.redemption.groupBy({
      by: ['status'],
      _sum: { payoutAmount: true, pointsUsed: true },
      _count: { _all: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="兌換紀錄 Redemptions"
        description="會員兌換贈品 + 公司應付給寄賣店家的撥款"
      />
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {REDEMPTION_STATUSES.map((s) => {
            const row = totals.find((r) => r.status === s);
            return (
              <Card key={s}>
                <CardContent className="p-4">
                  <p className="text-xs">
                    <StatusBadge kind="redemption" value={s} />
                  </p>
                  <p className="mt-1 text-xl font-semibold">
                    {formatCurrency(Number(row?._sum.payoutAmount ?? 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row?._count._all ?? 0} 筆 · 共 {row?._sum.pointsUsed ?? 0} 點
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          {redemptions.length === 0 ? (
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              尚無兌換紀錄
            </CardContent>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>編號</TableHead>
                  <TableHead>會員</TableHead>
                  <TableHead>贈品</TableHead>
                  <TableHead className="text-right">使用點數</TableHead>
                  <TableHead>履約店家</TableHead>
                  <TableHead className="text-right">公司應付</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.redemptionId}</TableCell>
                    <TableCell>
                      <Link
                        href={`/customers/${r.customer.id}`}
                        className="font-medium hover:underline"
                      >
                        {r.customer.name}
                      </Link>
                    </TableCell>
                    <TableCell>{r.reward.name}</TableCell>
                    <TableCell className="text-right">{r.pointsUsed}</TableCell>
                    <TableCell className="text-sm">
                      {r.payoutMerchant ? (
                        <Link
                          href={`/merchants/${r.payoutMerchant.id}`}
                          className="text-info hover:underline"
                        >
                          {r.payoutMerchant.name}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(r.payoutAmount))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="redemption" value={r.status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(r.createdAt)}
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
