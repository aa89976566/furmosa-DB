import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { SectionCard } from '@/components/shared/section-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MerchantStockTxnDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const txn = await prisma.merchantStockTxn.findUnique({
    where: { id: params.id },
    include: {
      merchant: { select: { id: true, name: true, merchantId: true } },
      product: { select: { id: true, name: true, sku: true } },
      order: { select: { id: true, orderNumber: true, status: true, total: true } },
      settlement: { select: { id: true, settlementId: true, status: true } },
    },
  });
  if (!txn) notFound();

  const qty = Math.abs(txn.quantity);

  return (
    <>
      <PageHeader
        title={txn.txnNumber}
        description={`${txn.merchant.name} · ${formatDateTime(txn.createdAt)}`}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href="/merchants/stock">
              <ArrowLeft className="mr-1 h-4 w-4" />
              返回庫存紀錄
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <SectionCard title="流水摘要">
          <dl className="space-y-3 text-sm">
            <Row label="類型">
              <StatusBadge kind="merchantStock" value={txn.type} />
            </Row>
            <Row label="店家">
              <Link href={`/merchants/${txn.merchant.id}`} className="font-medium hover:underline">
                {txn.merchant.name}
              </Link>
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {txn.merchant.merchantId}
              </span>
            </Row>
            <Row label="商品">
              <Link href={`/products/${txn.product.id}`} className="font-medium hover:underline">
                {txn.product.name}
              </Link>
              <span className="ml-2 font-mono text-xs text-muted-foreground">{txn.product.sku}</span>
            </Row>
            <Row label="數量">
              <span className="font-mono font-semibold tabular-nums">
                {txn.quantity > 0 ? '+' : ''}
                {txn.quantity}
              </span>
              <span className="text-muted-foreground">（異動後庫存 {txn.balanceAfter}）</span>
            </Row>
            {txn.unitPrice != null && (
              <>
                <Row label="單價">{formatCurrency(txn.unitPrice)}</Row>
                <Row label="銷售小計">{formatCurrency(txn.unitPrice * qty)}</Row>
              </>
            )}
            {txn.commissionAmount != null && (
              <Row label="店家分潤">{formatCurrency(txn.commissionAmount)}</Row>
            )}
            {txn.companyRevenue != null && (
              <Row label="公司實收">{formatCurrency(txn.companyRevenue)}</Row>
            )}
            <Row label="結算狀態">
              {txn.settlement ? (
                <Link
                  href={`/merchants/settlements/${txn.settlement.id}`}
                  className="font-mono text-xs hover:underline"
                >
                  {txn.settlement.settlementId}
                </Link>
              ) : (
                <span className="text-muted-foreground">未結清</span>
              )}
            </Row>
            {txn.note ? <Row label="備註">{txn.note}</Row> : null}
          </dl>
        </SectionCard>

        <SectionCard title="關聯訂單">
          {txn.order ? (
            <div className="space-y-3 text-sm">
              <p>
                此筆流水由訂單產生，可至訂單查看完整品項與金額明細。
              </p>
              <dl className="space-y-2">
                <Row label="訂單編號">
                  <Link
                    href={`/orders/${txn.order.id}`}
                    className="font-mono text-xs text-primary hover:underline"
                  >
                    {txn.order.orderNumber}
                  </Link>
                </Row>
                <Row label="狀態">
                  <StatusBadge kind="order" value={txn.order.status} />
                </Row>
                <Row label="訂單總額">{formatCurrency(Number(txn.order.total))}</Row>
              </dl>
              <Button asChild>
                <Link href={`/orders/${txn.order.id}`}>查看訂單內容</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              此筆為快速登記銷售或清點減量，未建立系統訂單。金額與庫存異動以本流水為準。
            </p>
          )}
        </SectionCard>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      <dt className="w-24 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
