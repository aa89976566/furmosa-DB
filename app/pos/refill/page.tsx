import Link from 'next/link';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { listMerchantRefillOrders } from '@/lib/refill/merchant';
import { PosShell } from '@/components/pos/pos-shell';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: '換罐計畫 · Furmosa 店家' };
export const dynamic = 'force-dynamic';

const OPEN = new Set([
  'paid_waiting_return',
  'old_container_verified',
  'awaiting_extra_payment',
  'payment_pending',
]);

const HUB = [
  {
    href: '/pos/restock/new?mode=SELF_SELECT',
    title: '我要自己選口味',
    hint: '選這期換罐商品、填數量',
  },
  {
    href: '/pos/restock/new?mode=AUTO_REPLENISH',
    title: '請幫我配口味',
    hint: '告訴公司需求，由公司幫你配',
  },
  {
    href: '/pos/restock/progress',
    title: '補貨進度',
    hint: '看公司確認到哪、預計何時到貨',
  },
] as const;

export default async function PosRefillHubPage() {
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
      <div className="px-4 py-6 space-y-6">
        <header>
          <p className="text-xs font-medium tracking-wide text-primary">換罐計畫</p>
          <h1 className="mt-1 text-xl font-semibold text-navy">換罐</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            客人來換罐、店裡補口味，都在這裡。
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-navy">待處理</h2>
          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : pending.length === 0 ? (
            <Card>
              <CardContent className="p-5 text-sm text-muted-foreground">
                目前沒有待處理的換罐客人。
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
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-navy">補口味</h2>
          <div className="grid gap-3">
            {HUB.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="shadow-card transition hover:border-primary/40">
                  <CardContent className="flex min-h-[72px] flex-col justify-center gap-1 p-4">
                    <p className="text-base font-semibold text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.hint}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
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
