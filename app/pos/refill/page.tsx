import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { listMerchantRefillOrders } from '@/lib/refill/merchant';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const metadata = { title: '待換罐 · Furmosa 店家' };
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
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        <header className="flex items-start justify-between gap-3 border-b border-[#e7e5e4] pb-5">
          <div>
            <p className="text-sm text-muted-foreground">門市工作</p>
            <h1 className="mt-1 text-2xl font-semibold">待換罐</h1>
            <p className="mt-1 text-sm text-muted-foreground">只顯示需要收空罐、補款或交付的訂單。</p>
          </div>
          <Button asChild variant="ghost" className="min-h-[44px]">
            <Link href="/pos">工作台</Link>
          </Button>
        </header>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : pending.length === 0 ? (
          <Card className="border-[#e7e5e4] bg-white shadow-none">
            <CardContent className="p-5 text-sm text-muted-foreground">
              目前沒有待處理的換罐。
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {pending.map((o) => (
              <li key={o.id}>
                <Link href={`/pos/refill/${o.id}`}>
                  <Card className="border-[#e7e5e4] bg-white shadow-none transition hover:border-[#8a8a8a]">
                    <CardContent className="p-4 min-h-[72px]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {o.petName ?? '毛孩'} · {o.time}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {o.productLabel} · {statusLabel(o.status, o.paid)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            尚可領取 {o.remainingQuantity}／{o.quantity} 罐
                          </p>
                          {o.missingContainerNote ? (
                            <p className="mt-1 text-xs text-amber-700">{o.missingContainerNote}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 text-sm font-medium">處理 ›</span>
                      </div>
                    </CardContent>
                  </Card>
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
      return '已付款 · 等待收空罐';
    case 'old_container_verified':
      return '已收空罐 · 待交付';
    case 'awaiting_extra_payment':
      return '等待補付差額';
    case 'completed':
      return '已完成';
    default:
      return status;
  }
}
