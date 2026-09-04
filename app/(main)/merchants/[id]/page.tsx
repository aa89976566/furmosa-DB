import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getMerchantShell } from '@/lib/merchants/load-merchant-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { MerchantOperationsHub } from './merchant-operations-hub';
import {
  MerchantSection,
  MerchantStat,
  MerchantStatGrid,
  MerchantWorkspace,
} from '@/components/merchants/merchant-ui';
import { Activity, ChevronRight, Settings } from 'lucide-react';

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
  const [merchant, shell, pendingRequests] = await Promise.all([
    prisma.merchant.findUnique({
      where: { id: params.id },
      include: {
        productRules: { select: { productId: true } },
        stocks: { select: { quantity: true, productId: true } },
        stockTxns: {
          include: { product: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    }),
    getMerchantShell(params.id),
    prisma.restockRequest.count({
      where: { merchantId: params.id, status: { in: ['submitted', 'under_review'] } },
    }),
  ]);
  if (!merchant) notFound();

  const productCount = new Set([
    ...merchant.stocks.map((s) => s.productId),
    ...merchant.productRules.map((r) => r.productId),
  ]).size;
  const totalStockUnits = merchant.stocks.reduce((s, r) => s + r.quantity, 0);
  const lowStock = merchant.stocks.filter((r) => r.quantity > 0 && r.quantity <= 3).length;
  const outOfStock = merchant.stocks.filter((r) => r.quantity === 0).length;

  return (
    <MerchantWorkspace>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-navy">店家總覽</h2>
          <p className="mt-1 text-sm text-muted-foreground">優先顯示需要處理的工作與營運狀態。</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}/ledger`}><Activity className="mr-1.5 h-4 w-4" />活動紀錄</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/merchants/${merchant.id}/settings`}><Settings className="mr-1.5 h-4 w-4" />合作設定</Link>
          </Button>
        </div>
      </div>

      <MerchantStatGrid className="lg:grid-cols-4">
        <MerchantStat label="待核准補貨" value={pendingRequests} suffix="筆" tone={pendingRequests ? 'warning' : 'default'} />
        <MerchantStat label="處理中出貨" value={shell.shipmentsInTransit} suffix="筆" />
        <MerchantStat label="商品總數" value={productCount} suffix="項" />
        <MerchantStat
          label="缺貨 / 庫存緊張"
          value={`${outOfStock} / ${lowStock}`}
          tone={outOfStock > 0 ? 'danger' : lowStock > 0 ? 'warning' : 'default'}
        />
      </MerchantStatGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <MerchantSection title="常用操作" description="補貨、清點、訂單與活動紀錄入口">
            <MerchantOperationsHub merchantId={merchant.id} />
          </MerchantSection>

          <MerchantSection
            title="最近動作"
            description="最新五筆庫存異動"
            action={
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/merchants/${merchant.id}/ledger`}>
                  查看全部
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            }
            contentClassName="px-0 py-0"
          >
            {merchant.stockTxns.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">尚無紀錄</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {merchant.stockTxns.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
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
          </MerchantSection>
        </div>

        <MerchantSection title="營運摘要" description="目前庫存與待處理狀態">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">目前在店庫存</p><p className="mt-1 text-xl font-semibold tabular-nums">{totalStockUnits} 件</p></div>
            <div className="rounded-xl bg-muted/40 p-4"><p className="text-xs text-muted-foreground">待結算</p><p className="mt-1 text-xl font-semibold tabular-nums">{shell.draftSettlements} 筆</p></div>
          </div>
          <Button variant="ghost" size="sm" className="mt-3 w-full justify-between" asChild>
            <Link href={`/merchants/${merchant.id}/shipments`}>查看訂單與出貨<ChevronRight className="h-4 w-4" /></Link>
          </Button>
        </MerchantSection>
      </div>
    </MerchantWorkspace>
  );
}
