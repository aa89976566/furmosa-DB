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
import { jarCodeStatusLabel } from '@/lib/jar-exchange/labels';

export const dynamic = 'force-dynamic';

export default async function CustomerJarCodesPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, customerId: true },
  });
  if (!customer) notFound();

  const codes = await prisma.jarCode.findMany({
    where: { redeemedByCustomerId: customer.id },
    orderBy: { redeemedAt: 'desc' },
    select: { code: true, status: true, redeemedAt: true, batchNo: true },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="返航序號紀錄"
        description={
          <span>
            {customer.name}
            <span className="ml-2 font-mono text-xs text-muted-foreground">
              {customer.customerId}
            </span>
          </span>
        }
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/customers/${customer.id}`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回客戶
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <SectionCard title={`序號紀錄（${codes.length} 筆）`} tone="supply">
          {codes.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無返航序號紀錄</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>序號</TableHead>
                  <TableHead>批次</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>兌換時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((c) => (
                  <TableRow key={c.code}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="text-muted-foreground">{c.batchNo ?? '—'}</TableCell>
                    <TableCell>{jarCodeStatusLabel[c.status] ?? c.status}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.redeemedAt ? formatDateTime(c.redeemedAt) : '—'}
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
