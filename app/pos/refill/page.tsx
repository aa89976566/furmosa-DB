import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { listMerchantRefillOrders } from '@/lib/refill/merchant';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';
import { RefillScanEntry } from '@/components/pos/refill-scan-entry';
import { loadPosAccount } from '@/lib/pos/account';

export const metadata = { title: '換罐 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

const OPEN = new Set([
  'paid_waiting_return',
  'old_container_verified',
  'awaiting_extra_payment',
  'payment_pending',
]);

export default async function PosRefillHubPage() {
  const session = await requireMerchantSession();
  const account = await loadPosAccount(session.merchantId, session.username);
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
    <PosShell storeName={account.storeName} account={account}>
      <div className="space-y-6 px-4 py-6 pr-16">
        <header>
          <h1 className="text-xl font-semibold text-navy">換罐</h1>
          <p className="mt-1 text-sm text-muted-foreground">掃罐底就能找到客人的訂單。</p>
        </header>

        <RefillScanEntry />

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-navy">待換罐</h2>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                目前沒有待換罐的客人。
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {pending.map((o) => (
                <li key={o.id}>
                  <Link href={`/pos/refill/${o.id}`}>
                    <Card className="shadow-card transition hover:border-primary/40">
                      <CardContent className="min-h-[72px] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{o.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {o.productLabel} · {statusLabel(o.status, o.paid)}
                            </p>
                            {o.missingContainerNote ? (
                              <p className="mt-1 text-xs text-amber-700">尚未帶回空罐</p>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-sm text-primary">處理</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PosShell>
  );
}

function statusLabel(status: string, paid: boolean): string {
  if (!paid && status === 'payment_pending') return '尚未付款';
  switch (status) {
    case 'paid_waiting_return':
      return '可以換罐';
    case 'old_container_verified':
      return '已回收 · 待交新罐';
    case 'awaiting_extra_payment':
      return '等待補差額';
    case 'completed':
      return '已完成';
    default:
      return status;
  }
}
