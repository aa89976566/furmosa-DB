'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PosAccountMenu } from '@/components/pos/account-menu';
import type { PosAccount } from '@/lib/pos/account';
import { loadRecentNotifications } from '@/app/pos/notification-actions';
import {
  mergeSeenNotificationKeys,
  notificationReadKey,
  unreadNotificationKeys,
} from '@/lib/pos/notification-read-state';

type RecentNotifications = Awaited<ReturnType<typeof loadRecentNotifications>>;

export function PosPageTools({ account }: { account: PosAccount }) {
  const [events, setEvents] = useState<RecentNotifications>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState<string[]>([]);
  const storageKey = `furmosa-pos-notifications-seen:${account.merchantId}`;

  const readSeenKeys = useCallback((): string[] => {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
      return Array.isArray(value)
        ? value.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const refreshNotifications = useCallback(async () => {
    const nextEvents = await loadRecentNotifications();
    setEvents(nextEvents);
    setUnread(unreadNotificationKeys(nextEvents, readSeenKeys()));
    return nextEvents;
  }, [readSeenKeys]);

  const markVisibleNotificationsRead = useCallback(
    (visible = events) => {
      if (visible.length === 0) return;
      const nextSeen = mergeSeenNotificationKeys(readSeenKeys(), visible);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(nextSeen));
      } catch {
        // The signal remains session-only when the browser blocks local storage.
      }
      setUnread([]);
    },
    [events, readSeenKeys, storageKey],
  );

  useEffect(() => {
    refreshNotifications().catch(() => setFailed(true));
  }, [refreshNotifications]);

  const unreadSet = useMemo(() => new Set(unread), [unread]);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      markVisibleNotificationsRead();
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      await refreshNotifications();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function closeNotifications() {
    markVisibleNotificationsRead();
    setOpen(false);
  }

  const toolClass = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-zinc-700 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900';
  return (
    <div className="flex shrink-0 items-center gap-2">
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
          <button
            type="button"
            className={`${toolClass} relative`}
            aria-label={unread.length > 0 ? `開啟通知，${unread.length} 則未讀` : '開啟通知'}
          >
            <Bell className="h-5 w-5" aria-hidden />
            {unread.length > 0 ? (
              <span
                className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white"
                aria-hidden="true"
              />
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] rounded-2xl">
          <h2 className="font-semibold">最新通知</h2>
          <div className="my-3 max-h-[50dvh] overflow-y-auto" aria-live="polite">
            {busy ? <p className="py-4 text-sm">載入中…</p> : failed ? <p className="py-4 text-sm">通知暫時無法載入，請重新開啟或查看全部通知。</p> : events.length === 0 ? <p className="py-4 text-sm text-zinc-500">目前沒有通知</p> : (
              <ul className="divide-y divide-neutral-200">
                {events.map((event) => {
                  const isUnread = unreadSet.has(notificationReadKey(event));
                  return (
                    <li key={event.id}>
                      <Link
                        onClick={closeNotifications}
                        href={event.href ?? '/pos/notifications'}
                        className={`block rounded-lg px-2 py-3 text-sm hover:bg-neutral-50 ${isUnread ? 'bg-blue-50/70' : ''}`}
                      >
                        <p className="flex items-center gap-2 font-medium">
                          {isUnread ? (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full bg-blue-600"
                              aria-label="未讀"
                            />
                          ) : null}
                          <span>{event.title}</span>
                        </p>
                        <p className="mt-1 text-zinc-500">
                          {event.statusLabel} ·{' '}
                          {new Date(event.occurredAt).toLocaleString('zh-TW', {
                            timeZone: 'Asia/Taipei',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <Link href="/pos/notifications" onClick={closeNotifications} className="flex min-h-11 items-center justify-center rounded-xl bg-zinc-900 px-4 text-sm text-white">查看全部通知</Link>
        </PopoverContent>
      </Popover>
      <PosAccountMenu account={account} />
    </div>
  );
}
