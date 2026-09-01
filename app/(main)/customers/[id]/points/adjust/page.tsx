import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { canAdjustMemberPoints } from '@/lib/jar-exchange/manual-points';
import { ledgerSourceLabel } from '@/lib/jar-exchange/labels';
import { formatDateTime, formatNumber } from '@/lib/format';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { MemberPointsAdjustmentForm } from '@/components/jar-exchange/member-points-adjustment-form';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function AdjustCustomerPointsPage({
  params,
}: {
  params: { id: string };
}) {
  const [actor, customer, ledger] = await Promise.all([
    getCurrentUser(),
    prisma.customer.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        customerId: true,
        lineDisplay: true,
        lineUserId: true,
      },
    }),
    prisma.memberPointsLedger.findMany({
      where: { customerId: params.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { createdBy: { select: { name: true } } },
    }),
  ]);

  if (!customer) notFound();
  const currentBalance = ledger[0]?.balanceAfter ?? 0;
  const authorized = Boolean(actor && canAdjustMemberPoints(actor.role));

  return (
    <>
      <PageHeader
        tone="supply"
        title="調整會員點數"
        description="先確認會員，再預覽餘額；送出後會留下原因、操作者與完整流水。"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/customers/${customer.id}/jar-ledger`}>
                <BookOpen className="mr-1 h-4 w-4" />
                完整帳本
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/customers/${customer.id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回會員
              </Link>
            </Button>
          </div>
        }
      />

      <main className="mx-auto max-w-3xl space-y-6 p-4 pb-10 sm:p-6">
        {authorized ? (
          <MemberPointsAdjustmentForm
            customerId={customer.id}
            customerName={customer.name}
            memberNumber={customer.customerId}
            lineDisplay={customer.lineDisplay}
            lineUserId={customer.lineUserId}
            currentBalance={currentBalance}
            initialRequestId={randomUUID()}
          />
        ) : (
          <SectionCard title="無法調整點數" tone="supply">
            <p className="text-sm text-muted-foreground">
              此功能僅開放 HQ 管理員與客服人員。你仍可查看下方帳本紀錄。
            </p>
          </SectionCard>
        )}

        <SectionCard
          title="最近點數流水"
          description={`${customer.name} 的最近 ${ledger.length} 筆紀錄`}
          tone="supply"
        >
          {ledger.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-medium text-navy">尚無點數紀錄</p>
              <p className="mt-1 text-sm text-muted-foreground">
                第一次調整完成後，紀錄會顯示在這裡。
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>時間／原因</TableHead>
                    <TableHead>操作者</TableHead>
                    <TableHead className="text-right">變動</TableHead>
                    <TableHead className="text-right">餘額</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <p className="font-medium">
                          {entry.note ?? ledgerSourceLabel[entry.sourceType] ?? entry.sourceType}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDateTime(entry.createdAt)} ·{' '}
                          {ledgerSourceLabel[entry.sourceType] ?? entry.sourceType}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {entry.createdBy?.name ?? '系統'}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          entry.pointsChange >= 0 ? 'text-success' : 'text-info'
                        }`}
                      >
                        {entry.pointsChange > 0 ? '+' : ''}
                        {formatNumber(entry.pointsChange)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(entry.balanceAfter)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </SectionCard>
      </main>
    </>
  );
}
