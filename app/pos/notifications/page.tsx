import Link from 'next/link';
import { Bell, ChevronRight } from 'lucide-react';
import { PosShell } from '@/components/pos/pos-shell';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { loadMerchantEvents } from '@/lib/pos/load-merchant-events';

export const metadata = { title: '通知 · Furmosa 店家' };

export default async function PosNotificationsPage() {
  const session = await requireMerchantSession();
  const [account, events] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadMerchantEvents(session.merchantId),
  ]);

  return (
    <PosShell storeName={account.storeName} account={account}>
      <main className="px-4 pb-8 pt-20 md:px-6 md:pt-20">
        <header className="mb-6">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background">
            <Bell className="h-5 w-5" aria-hidden />
          </div>
          <h1 className="text-2xl font-semibold">通知</h1>
          <p className="mt-1 text-sm text-muted-foreground">補貨申請與 HQ 出貨的最新進度</p>
        </header>

        {events.length === 0 ? (
          <section className="rounded-3xl border bg-card p-8 text-center">
            <p className="font-medium">目前沒有店家通知</p>
            <p className="mt-1 text-sm text-muted-foreground">HQ 更新補貨或出貨狀態後會顯示在這裡。</p>
          </section>
        ) : (
          <section className="space-y-3" aria-label="店家通知列表">
            {events.map((event) => {
              const content = (
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      event.actionRequired ? 'bg-foreground' : 'bg-muted-foreground/35'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="font-semibold">{event.title}</h2>
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                        {event.statusLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p>
                    {event.hqNote ? (
                      <p className="mt-2 rounded-xl bg-secondary/70 px-3 py-2 text-sm">HQ 回覆：{event.hqNote}</p>
                    ) : null}
                    <time className="mt-2 block text-xs text-muted-foreground">
                      {event.occurredAt.toLocaleString('zh-TW')}
                    </time>
                  </div>
                  {event.href ? <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden /> : null}
                </div>
              );
              return event.href ? (
                <Link
                  key={event.id}
                  href={event.href}
                  className="block rounded-2xl border bg-card p-4 transition hover:border-foreground/30"
                >
                  {content}
                </Link>
              ) : (
                <article key={event.id} className="rounded-2xl border bg-card p-4">
                  {content}
                </article>
              );
            })}
          </section>
        )}
      </main>
    </PosShell>
  );
}
