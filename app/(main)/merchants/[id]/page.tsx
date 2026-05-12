import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { SectionCard } from '@/components/shared/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { merchantTypeLabel } from '@/lib/labels';
import { MerchantOperationsHub } from './merchant-operations-hub';
import { ChevronRight } from 'lucide-react';

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

export default async function MerchantOverviewPage({
  params,
}: {
  params: { id: string };
}) {
  const merchant = await prisma.merchant.findUnique({
    where: { id: params.id },
    include: {
      productRules: { select: { id: true } },
      stocks: { select: { quantity: true, productId: true } },
      stockTxns: {
        include: { product: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });
  if (!merchant) notFound();

  const productCount = new Set([
    ...merchant.stocks.map((s) => s.productId),
    ...merchant.productRules.map((r) => r.id),
  ]).size;
  const totalStockUnits = merchant.stocks.reduce((s, r) => s + r.quantity, 0);
  const lowStock = merchant.stocks.filter((r) => r.quantity > 0 && r.quantity <= 3).length;
  const outOfStock = merchant.stocks.filter((r) => r.quantity === 0).length;

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-4">
      <div className="lg:col-span-3 space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi label="商品總數" value={productCount} suffix="項" />
          <Kpi label="目前在店庫存" value={totalStockUnits} suffix="件" />
          <Kpi
            label="缺貨 / 庫存緊張"
            value={`${outOfStock} / ${lowStock}`}
            tone={outOfStock > 0 ? 'danger' : lowStock > 0 ? 'warning' : 'default'}
          />
        </div>

        <MerchantOperationsHub merchantId={merchant.id} />

        <SectionCard
          title="最近動作"
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/merchants/${merchant.id}/ledger`}>
                查看全部
                <ChevronRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          }
        >
          {merchant.stockTxns.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">尚無紀錄</p>
          ) : (
            <ul className="divide-y">
              {merchant.stockTxns.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 py-3 text-sm"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Badge variant={stockTxnTypeStyle[t.type] ?? 'secondary'}>
                      {stockTxnTypeLabel[t.type] ?? t.type}
                    </Badge>
                    <Link
                      href={`/products/${t.productId}`}
                      className="truncate font-medium hover:underline"
                    >
                      {t.product.name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-4 whitespace-nowrap">
                    <span
                      className={
                        t.quantity > 0
                          ? 'font-mono font-semibold text-success'
                          : t.quantity < 0
                            ? 'font-mono font-semibold text-destructive'
                            : 'font-mono'
                      }
                    >
                      {t.quantity > 0 ? '+' : ''}
                      {t.quantity}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(t.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard title="店家資料" className="lg:col-span-1 lg:row-start-1">
        <dl className="space-y-2 text-sm">
          <Row label="編號" value={<span className="font-mono">{merchant.merchantId}</span>} />
          <Row
            label="類型"
            value={<Badge variant="secondary">{merchantTypeLabel[merchant.type]}</Badge>}
          />
          <Row label="聯絡人" value={merchant.contactName ?? '-'} />
          <Row label="電話" value={merchant.phone ?? '-'} />
          <Row label="Email" value={merchant.email ?? '-'} />
          <Row label="城市" value={merchant.city ?? '-'} />
          <Row label="地址" value={merchant.address ?? '-'} />
          <Row
            label="預設店家分潤"
            value={`${(merchant.commissionRate * 100).toFixed(0)}%`}
          />
        </dl>
      </SectionCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function Kpi({
  label,
  value,
  suffix,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  suffix?: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : '';
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>
        {value}
        {suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}
