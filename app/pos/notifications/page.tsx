import Link from 'next/link';
import { Bell } from 'lucide-react';
import { PosShell } from '@/components/pos/pos-shell';
import { requireMerchantSession } from '@/lib/merchant-auth';
import { loadPosAccount } from '@/lib/pos/account';
import { loadMerchantEvents } from '@/lib/pos/load-merchant-events';
import { loadMerchantNotificationInbox } from '@/lib/pos/merchant-notification-inbox';
import {
  openMerchantNotification,
  readMerchantNotification,
} from '@/app/pos/unread-notification-actions';

export const metadata = { title: '通知 · Furmosa 店家' };

export default async function PosNotificationsPage() {
  const session = await requireMerchantSession();
  const [account, events, inbox] = await Promise.all([
    loadPosAccount(session.merchantId, session.username),
    loadMerchantEvents(session.merchantId),
    loadMerchantNotificationInbox(session, 100),
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

        {inbox.unreadCount > 0 ? (
          <section className="mb-6 space-y-3" aria-label="未讀通知">
            <h2 className="text-lg font-semibold">未讀通知 {inbox.unreadCount}</h2>
            {inbox.notifications.map((notice) => (
              <article key={notice.id} className="rounded-2xl border-2 border-foreground bg-card p-4">
                <p className="font-semibold">{notice.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{notice.shipmentNumber}</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <form action={openMerchantNotification.bind(null, notice.id)}>
                    <button type="submit" className="min-h-11 text-sm font-medium underline underline-offset-4">查看出貨單</button>
                  </form>
                  <form action={readMerchantNotification.bind(null, notice.id)}>
                    <button type="submit" className="min-h-11 rounded-xl border px-4 text-sm">標記已讀</button>
                  </form>
                </div>
              </article>
            ))}
            {inbox.unreadCount > inbox.notifications.length ? (
              <p className="text-sm text-muted-foreground">尚有更早的未讀通知，請聯絡總部協助查詢。</p>
            ) : null}
          </section>
        ) : null}

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
                    {event.href ? (
                      <span
                        className={`mt-3 inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold transition duration-200 ${
                          event.actionRequired
                            ? 'bg-foreground text-background shadow-[0_8px_20px_rgba(0,0,0,0.14)] group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_24px_rgba(0,0,0,0.2)] group-active:translate-y-0 group-active:scale-[0.98]'
                            : 'bg-secondary text-foreground group-hover:bg-foreground group-hover:text-background'
                        }`}
                      >
                        {event.actionRequired ? '查看運送並確認收貨' : '查看詳情'}
                        {event.actionRequired ? (
                          <span className="ml-2 h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_0_4px_rgba(190,242,100,0.15)]" aria-hidden />
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
              return event.href ? (
                <Link
                  key={event.id}
                  href={event.href}
                  className="group block rounded-2xl border bg-card p-4 transition duration-200 hover:border-foreground/40 hover:shadow-[0_12px_28px_rgba(0,0,0,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/80"
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
