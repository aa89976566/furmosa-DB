'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PosAccountMenu } from '@/components/pos/account-menu';
import type { PosAccount } from '@/lib/pos/account';
import { loadRecentNotifications } from '@/app/pos/notification-actions';
import {
  loadUnreadNotifications,
  readMerchantNotification,
} from '@/app/pos/unread-notification-actions';

type RecentNotifications = Awaited<ReturnType<typeof loadRecentNotifications>>;
type Inbox = Awaited<ReturnType<typeof loadUnreadNotifications>>;
type UnreadNotice = Inbox['notifications'][number];

const NOTIFICATION_LOAD_TIMEOUT_MS = 12_000;

function withNotificationTimeout<T>(request: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error('通知載入逾時')),
      NOTIFICATION_LOAD_TIMEOUT_MS,
    );
    request.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

export function PosPageTools({ account }: { account: PosAccount }) {
  const router = useRouter();
  const [events, setEvents] = useState<RecentNotifications>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [inboxFailed, setInboxFailed] = useState(false);
  const [hint, setHint] = useState<UnreadNotice | null>(null);
  const initialInboxLoaded = useRef(false);

  const refreshInbox = useCallback(async () => {
    try {
      const current = await loadUnreadNotifications();
      setInbox(current);
      setInboxFailed(false);
      if (!initialInboxLoaded.current) {
        initialInboxLoaded.current = true;
        const newest = current.notifications[0];
        if (newest) {
          const key = `pos-dispatch-hint:${current.sessionKey}:${newest.id}:${newest.occurredAt}`;
          try {
            if (!sessionStorage.getItem(key)) setHint(newest);
          } catch {
            setHint(newest);
          }
        }
      }
      if (current.unreadCount === 0) setHint(null);
    } catch {
      setInboxFailed(true);
    }
  }, []);

  useEffect(() => {
    void refreshInbox();
    const interval = window.setInterval(() => {
      if (!document.hidden) void refreshInbox();
    }, 60_000);
    const onVisible = () => {
      if (!document.hidden) void refreshInbox();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshInbox]);

  function dismissHint() {
    if (hint && inbox) {
      try {
        sessionStorage.setItem(
          `pos-dispatch-hint:${inbox.sessionKey}:${hint.id}:${hint.occurredAt}`,
          '1',
        );
      } catch {
        // In private browsing, the in-memory dismissal still works for this page.
      }
    }
    setHint(null);
  }

  async function readAndOpen(notice: UnreadNotice) {
    dismissHint();
    try {
      await readMerchantNotification(notice.id);
      await refreshInbox();
    } catch {
      setInboxFailed(true);
    }
    setOpen(false);
    router.push(notice.href);
  }

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setBusy(true);
    setFailed(false);
    const [inboxResult, eventsResult] = await Promise.allSettled([
      withNotificationTimeout(refreshInbox()),
      withNotificationTimeout(loadRecentNotifications()),
    ]);
    if (eventsResult.status === 'fulfilled') {
      setEvents(eventsResult.value);
    } else {
      setFailed(true);
    }
    if (inboxResult.status === 'rejected') setInboxFailed(true);
    setBusy(false);
  }

  const toolClass = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-zinc-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900';
  return (
    <div className="flex shrink-0 items-center gap-2">
      {hint ? (
        <div role="status" className="fixed inset-x-4 top-20 z-[190] rounded-2xl border-2 border-zinc-900 bg-white p-4 shadow-lg md:inset-x-auto md:right-6 md:w-80">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{hint.title}</p>
              <p className="mt-1 text-sm text-zinc-600">{hint.shipmentNumber} · 請查看出貨進度</p>
            </div>
            <button type="button" onClick={dismissHint} aria-label="稍後查看通知" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-zinc-900"><X className="h-4 w-4" aria-hidden /></button>
          </div>
          <button type="button" onClick={() => void readAndOpen(hint)} className="mt-3 min-h-11 w-full rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white">查看出貨單</button>
        </div>
      ) : null}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={toolClass} aria-label="查詢紀錄"><Search className="h-5 w-5" aria-hidden /></button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] rounded-2xl">
          <form action="/pos/records" className="space-y-3" role="search">
            <label htmlFor="pos-record-search" className="block font-semibold">查詢紀錄</label>
            <input id="pos-record-search" name="q" type="search" placeholder="訂單、商品、罐子序號" className="h-11 w-full rounded-xl border border-neutral-300 px-3 text-sm" />
            <button className="min-h-11 w-full rounded-xl bg-zinc-900 px-4 text-sm text-white">搜尋紀錄</button>
          </form>
        </PopoverContent>
      </Popover>
      <Popover open={open} onOpenChange={onOpenChange}>
        <PopoverTrigger asChild>
          <button type="button" className={`relative ${toolClass}`} aria-label={inboxFailed ? '通知暫時無法更新' : `開啟通知${inbox?.unreadCount ? `，${inbox.unreadCount} 則未讀` : ''}`}>
            <Bell className="h-5 w-5" aria-hidden />
            {inbox?.unreadCount ? <span aria-hidden className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1 text-[11px] font-semibold text-white">{inbox.unreadCount > 99 ? '99+' : inbox.unreadCount}</span> : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] rounded-2xl">
          <h2 className="font-semibold">最新通知</h2>
          {inboxFailed ? <p role="status" className="mt-2 text-xs text-red-700">未讀狀態暫時無法更新，請稍後重試。</p> : null}
          <div className="my-3 max-h-[50dvh] overflow-y-auto" aria-live="polite">
            {busy ? <p className="py-4 text-sm">載入中…</p> : failed ? <p className="py-4 text-sm">通知暫時無法載入，請重新開啟或查看全部通知。</p> : events.length === 0 ? <p className="py-4 text-sm text-zinc-500">目前沒有通知</p> : (
              <ul className="divide-y divide-neutral-200">
                {events.map((event) => <li key={event.id}>
                  {inbox?.notifications.find((notice) => `shipment-${notice.shipmentId}` === event.id) ? <button type="button" onClick={() => { const notice = inbox.notifications.find((candidate) => `shipment-${candidate.shipmentId}` === event.id); if (notice) void readAndOpen(notice); }} className="block w-full rounded-lg py-3 text-left text-sm hover:bg-neutral-50">
                    <p className="font-medium">{event.title} <span className="text-xs">· 未讀</span></p>
                    <p className="mt-1 text-zinc-500">{event.statusLabel} · {new Date(event.occurredAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </button> : <Link onClick={() => setOpen(false)} href={event.href ?? '/pos/notifications'} className="block rounded-lg py-3 text-sm hover:bg-neutral-50">
                    <p className="font-medium">{event.title}</p>
                    <p className="mt-1 text-zinc-500">{event.statusLabel} · {new Date(event.occurredAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </Link>}
                </li>)}
              </ul>
            )}
          </div>
          <Link href="/pos/notifications" onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm text-white">查看全部通知</Link>
        </PopoverContent>
      </Popover>
      <PosAccountMenu account={account} />
    </div>
  );
}
