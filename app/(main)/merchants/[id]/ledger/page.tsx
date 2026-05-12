import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

type BadgeVariant = 'success' | 'info' | 'warning' | 'secondary' | 'destructive';
const stockTxnTypeLabel: Record<string, string> = {
  restock: '進貨',
  sale: '銷售',
  adjust: '盤點',
  return: '退回',
};
const stockTxnTypeStyle: Record<string, BadgeVariant> = {
  restock: 'success',
  sale: 'info',
  adjust: 'warning',
  return: 'secondary',
};

export default async function MerchantLedgerPage({ params }: { params: { id: string } }) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!merchant) notFound();

  const txns = await prisma.merchantStockTxn.findMany({
    where: { merchantId: merchant.id },
    include: { product: true, order: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-6 p-6">
      <SectionCard title={`動作流水（最近 ${txns.length} 筆）`}>
        {txns.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">尚無紀錄</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>時間</TableHead>
                <TableHead>類型</TableHead>
                <TableHead>商品</TableHead>
                <TableHead className="text-right">數量</TableHead>
                <TableHead className="text-right">異動後庫存</TableHead>
                <TableHead className="text-right">公司實收</TableHead>
                <TableHead>備註 / 訂單</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(t.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={stockTxnTypeStyle[t.type] ?? 'secondary'}>
                      {stockTxnTypeLabel[t.type] ?? t.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/products/${t.productId}`}
                      className="hover:underline"
                    >
                      {t.product.name}
                    </Link>
                  </TableCell>
                  <TableCell
                    className={
                      t.quantity > 0
                        ? 'text-right font-mono font-semibold text-success'
                        : t.quantity < 0
                          ? 'text-right font-mono font-semibold text-destructive'
                          : 'text-right font-mono'
                    }
                  >
                    {t.quantity > 0 ? '+' : ''}
                    {t.quantity}
                  </TableCell>
                  <TableCell className="text-right font-mono">{t.balanceAfter}</TableCell>
                  <TableCell className="text-right">
                    {t.companyRevenue != null ? formatCurrency(Number(t.companyRevenue)) : '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {t.order ? (
                      <Link href={`/orders/${t.order.id}`} className="hover:underline">
                        {t.order.orderNumber}
                      </Link>
                    ) : (
                      (t.note ?? '-')
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
