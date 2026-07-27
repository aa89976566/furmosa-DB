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
      <div className="px-4 py-6 space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Furmosa 店家</p>
            <h1 className="text-xl font-semibold">待換罐</h1>
          </div>
          <Button asChild variant="ghost" className="min-h-[44px]">
            <Link href="/pos">今天</Link>
          </Button>
        </header>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : pending.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              目前沒有待處理的換罐。
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {pending.map((o) => (
              <li key={o.id}>
                <Link href={`/pos/refill/${o.id}`}>
                  <Card className="shadow-card transition hover:border-primary/40">
                    <CardContent className="p-4 min-h-[72px]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">
                            {o.petName ?? '毛孩'} · {o.time}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {o.productLabel} · {statusLabel(o.status, o.paid)}
                          </p>
                          {o.missingContainerNote ? (
                            <p className="mt-1 text-xs text-amber-700">{o.missingContainerNote}</p>
                          ) : null}
                        </div>
                        <span className="text-sm text-primary shrink-0">處理</span>
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
