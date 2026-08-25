import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import { Button } from '@/components/ui/button';
import { SHIPMENT_KIND_TABS } from '@/lib/order-hub-kinds';
import { Package } from 'lucide-react';
import { ShipmentsQueueBody } from './shipments-queue-body';

export const dynamic = 'force-dynamic';

export default function ShipmentsPage({
  searchParams,
}: {
  searchParams?: {
    status?: string;
    type?: string;
    s?: string;
    q?: string;
    error?: string;
    delivered?: string;
  };
}) {
  const status = searchParams?.status;
  const rawType = searchParams?.type;
  const actionError = (searchParams?.error ?? '').trim();
  const deliveredOk = searchParams?.delivered === '1';
  const type =
    rawType === 'merchant_restock' || rawType === 'restock' ? 'consignment' : rawType;

  return (
    <>
      <PageHeader
        tone="logistics"
        title="出貨隊列"
        description="統一出貨工作台 — 寄賣店成交與進貨請看「寄賣」；官網/LINE 請看「直客訂單」"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/orders" prefetch>
                訂單列表
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/inventory/transactions">
                <Package className="mr-1 h-4 w-4" />
                庫存異動
              </Link>
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-full text-xs font-medium text-muted-foreground sm:w-auto">
            種類
          </span>
          {SHIPMENT_KIND_TABS.map((t) => {
            const active =
              (type ?? '') === t.key ||
              (t.key === 'consignment' &&
                (rawType === 'restock' || rawType === 'merchant_restock'));
            const params = new URLSearchParams();
            if (t.key) params.set('type', t.key);
            if (status) params.set('status', status);
            const href = params.toString() ? `/shipments?${params}` : '/shipments';
            return (
              <Button
                key={t.key || 'all'}
                variant={active ? 'default' : 'outline'}
                size="sm"
                asChild
              >
                <Link href={href} prefetch>
                  {t.label}
                </Link>
              </Button>
            );
          })}
        </div>

        {type === 'customer_order' ? (
          <div className="rounded-xl border border-info/30 bg-info/[0.06] px-4 py-3 text-sm text-muted-foreground">
            <p>
              「直客訂單」不含寄賣店成交。若剛建立{' '}
              <strong className="font-medium text-foreground">淡水妞妞、柒沐</strong>{' '}
              等寄賣店訂單，請改看{' '}
              <Link
                href="/shipments?type=consignment"
                className="font-medium text-info hover:underline"
                prefetch
              >
                寄賣
              </Link>{' '}
              分類。
            </p>
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {actionError}
          </div>
        ) : null}

        {deliveredOk ? (
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            已標記貨物到達，該單已離開「在途」。
          </div>
        ) : null}

        <Suspense
          key={`${status ?? ''}|${type ?? ''}|${searchParams?.q ?? ''}|${searchParams?.s ?? ''}|${searchParams?.delivered ?? ''}`}
          fallback={<PageSkeleton variant="workspace" className="p-0" />}
        >
          <ShipmentsQueueBody searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}
