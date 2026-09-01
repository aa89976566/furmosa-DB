import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import { ledgerSourceLabel } from '@/lib/jar-exchange/labels';

export const dynamic = 'force-dynamic';

export default async function CustomerJarLedgerPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, customerId: true },
  });
  if (!customer) notFound();

  const ledger = await prisma.memberPointsLedger.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="點數帳本"
        description={
          <span>
            {customer.name}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {customer.customerId}
            </span>
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link href={`/customers/${customer.id}/points/adjust`}>調整點數</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/customers/${customer.id}`}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                返回客戶
              </Link>
            </Button>
          </div>
        }
      />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <SectionCard title={`流水明細（${ledger.length} 筆）`} tone="supply">
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無點數流水</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>來源</TableHead>
                  <TableHead>備註</TableHead>
                  <TableHead className="text-right">變動</TableHead>
                  <TableHead className="text-right">餘額</TableHead>
                  <TableHead>時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{ledgerSourceLabel[e.sourceType] ?? e.sourceType}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {e.note ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {e.pointsChange > 0 ? '+' : ''}
                      {e.pointsChange}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.balanceAfter}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(e.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </>
  );
}
