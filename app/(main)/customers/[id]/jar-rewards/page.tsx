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

export const dynamic = 'force-dynamic';

export default async function CustomerJarRewardsPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, customerId: true },
  });
  if (!customer) notFound();

  const redemptions = await prisma.groomingCoupon.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="兌換獎勵歷史"
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
        <SectionCard title={`兌換紀錄（${redemptions.length} 筆）`} tone="supply">
          {redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">尚無兌換紀錄</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>折價券</TableHead>
                  <TableHead>優惠券碼</TableHead>
                  <TableHead className="text-right">扣除點數</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>發行／核銷時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">美容折價券 NT${r.discountAmount}</TableCell>
                    <TableCell className="font-mono text-xs">{r.couponCode}</TableCell>
                    <TableCell className="text-right tabular-nums">−{r.pointsUsed}</TableCell>
                    <TableCell>
                      {r.status === 'available'
                        ? '可使用'
                        : r.status === 'redeemed'
                          ? '已核銷'
                          : r.status === 'expired'
                            ? '已過期'
                            : r.status}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                      {r.redeemedAt ? <span className="block text-xs">{r.redeemedStore ?? '店家'}核銷 {formatDateTime(r.redeemedAt)}</span> : <span className="block text-xs">有效至 {formatDateTime(r.expiresAt)}</span>}
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
