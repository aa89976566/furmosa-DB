import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { listMerchantRefillOrders } from '@/lib/refill/merchant';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight, CircleDollarSign, PackageCheck } from 'lucide-react';

export const metadata = { title: '換罐訂單 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

const OPEN = new Set([
  'paid_waiting_return',
  'old_container_verified',
  'awaiting_extra_payment',
  'payment_pending',
]);

export default async function PosRefillListPage() {
  const session = await requireMerchantSession();
  let orders: Awaited<ReturnType<typeof listMerchantRefillOrders>> = [];
  let error: string | null = null;
  try {
    orders = await listMerchantRefillOrders(session.merchantId);
  } catch (e) {
    console.error('[pos.refill]', e);
    error = '暫時無法讀取換罐訂單，請稍後再試。';
  }

  const pending = orders.filter((o) => OPEN.has(o.status));

  return (
    <PosShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex items-start justify-between gap-4 border-b border-[#dedede] pb-6">
          <div>
            <p className="text-sm text-muted-foreground">門市工作</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">換罐訂單</h1>
            <p className="mt-1 text-sm text-muted-foreground">選擇一筆訂單，確認空罐與本次要交付的數量。</p>
          </div>
          <Button asChild variant="ghost" className="min-h-[44px]">
            <Link href="/pos">工作台</Link>
          </Button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2" aria-label="換罐工作摘要">
          <div className="rounded-2xl border border-[#e7e5e4] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">等待門市處理</p>
              <PackageCheck className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight">{pending.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">已付款或等待確認的訂單</p>
          </div>
          <div className="rounded-2xl border border-[#e7e5e4] bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">等待客人付款</p>
              <CircleDollarSign className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {pending.filter((order) => order.status === 'payment_pending' || order.status === 'awaiting_extra_payment').length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">付款完成後才能交付</p>
          </div>
        </section>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : pending.length === 0 ? (
          <Card className="border-[#e7e5e4] bg-white shadow-none">
            <CardContent className="p-5 text-sm text-muted-foreground">
              目前沒有需要處理的換罐訂單。
            </CardContent>
          </Card>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-[#e7e5e4] bg-white">
            {pending.map((o) => (
              <li key={o.id} className="border-b border-[#e7e5e4] last:border-b-0">
                <Link href={`/pos/refill/${o.id}`} className="block transition hover:bg-[#fafafa]">
                    <div className="flex min-h-[92px] items-center justify-between gap-4 p-4 sm:px-5">
                        <div>
                          <p className="font-semibold text-[#191919]">
                            {o.petName ?? '毛孩'} · {o.time}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {o.productLabel} · {statusLabel(o.status, o.paid)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            客人還可領 {o.remainingQuantity} 罐（共買 {o.quantity} 罐）
                          </p>
                          {o.missingContainerNote ? (
                            <p className="mt-1 text-xs text-amber-700">{o.missingContainerNote}</p>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
                          <span className="hidden sm:inline">開始處理</span>
                          <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PosShell>
  );
}

function statusLabel(status: string, paid: boolean): string {
  if (!paid && status === 'payment_pending') return '尚未付款';
  switch (status) {
    case 'paid_waiting_return':
      return '已付款 · 請確認空罐';
    case 'old_container_verified':
      return '空罐已收 · 可以交付';
    case 'awaiting_extra_payment':
      return '等待客人補款';
    case 'completed':
      return '已完成';
    default:
      return status;
  }
}
