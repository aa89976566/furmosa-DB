'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PosAccountMenu } from '@/components/pos/account-menu';
import type { PosAccount } from '@/lib/pos/account';
import { loadRecentNotifications } from '@/app/pos/notification-actions';

type RecentNotifications = Awaited<ReturnType<typeof loadRecentNotifications>>;

export function PosPageTools({ account }: { account: PosAccount }) {
  const [events, setEvents] = useState<RecentNotifications>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  async function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) return;
    setBusy(true);
    setFailed(false);
    try {
      setEvents(await loadRecentNotifications());
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
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
          <button type="button" className={toolClass} aria-label="開啟通知"><Bell className="h-5 w-5" aria-hidden /></button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))] rounded-2xl">
          <h2 className="font-semibold">最新通知</h2>
          <div className="my-3 max-h-[50dvh] overflow-y-auto" aria-live="polite">
            {busy ? <p className="py-4 text-sm">載入中…</p> : failed ? <p className="py-4 text-sm">通知暫時無法載入，請重新開啟或查看全部通知。</p> : events.length === 0 ? <p className="py-4 text-sm text-zinc-500">目前沒有通知</p> : (
              <ul className="divide-y divide-neutral-200">
                {events.map((event) => <li key={event.id}>
                  <Link onClick={() => setOpen(false)} href={event.href ?? '/pos/notifications'} className="block rounded-lg py-3 text-sm hover:bg-neutral-50">
                    <p className="font-medium">{event.title}</p>
                    <p className="mt-1 text-zinc-500">{event.statusLabel} · {new Date(event.occurredAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </Link>
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
