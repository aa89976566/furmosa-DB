import Link from 'next/link';
import { Suspense } from 'react';
import { PageSkeleton } from '@/components/shared/page-skeleton';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SHIPMENT_KIND_TABS } from '@/lib/order-hub-kinds';
import {
  Check,
  ChevronDown,
  ClipboardList,
  MoreHorizontal,
  Package,
} from 'lucide-react';
import { ShipmentsQueueBody } from './shipments-queue-body';

export const dynamic = 'force-dynamic';

export default async function ShipmentsPage(
  props: {
    searchParams?: Promise<{
      status?: string;
      type?: string;
      s?: string;
      q?: string;
      error?: string;
      delivered?: string;
    }>;
  }
) {
  const searchParams = await props.searchParams;
  const status = searchParams?.status;
  const rawType = searchParams?.type;
  const actionError = (searchParams?.error ?? '').trim();
  const deliveredOk = searchParams?.delivered === '1';
  const type =
    rawType === 'merchant_restock' || rawType === 'restock' ? 'consignment' : rawType;
  const activeType =
    SHIPMENT_KIND_TABS.find((item) => item.key === (type ?? '')) ?? SHIPMENT_KIND_TABS[0];

  return (
    <div className="grid gap-4 p-4 sm:gap-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-4">
        <h1 className="text-xl font-semibold tracking-tight text-navy sm:text-2xl">出貨</h1>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-32 justify-between">
                <span>訂單種類：{activeType.label}</span>
                <ChevronDown className="ml-2 h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>篩選訂單種類</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SHIPMENT_KIND_TABS.map((item) => {
                const params = new URLSearchParams();
                if (item.key) params.set('type', item.key);
                if (status) params.set('status', status);
                const href = params.toString() ? `/shipments?${params}` : '/shipments';
                const active = item.key === (type ?? '');
                return (
                  <DropdownMenuItem key={item.key || 'all'} asChild>
                    <Link
                      href={href}
                      prefetch
                      className="flex min-h-10 items-center justify-between"
                    >
                      <span>{item.label}</span>
                      {active ? <Check className="h-4 w-4" /> : null}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="更多出貨工具">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/orders" prefetch className="min-h-10">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  訂單列表
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/inventory/transactions" className="min-h-10">
                  <Package className="mr-2 h-4 w-4" />
                  庫存異動
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
          已標記貨物到達，該單已移至「待驗收」。
        </div>
      ) : null}

      <Suspense
        key={`${status ?? ''}|${type ?? ''}|${searchParams?.q ?? ''}|${searchParams?.s ?? ''}|${searchParams?.delivered ?? ''}`}
        fallback={<PageSkeleton variant="workspace" className="p-0" />}
      >
        <ShipmentsQueueBody searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
