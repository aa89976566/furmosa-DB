'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatCurrency } from '@/lib/format';
import { orderSourceLabel } from '@/lib/labels';
import {
  isStandaloneDisplayMode,
  subscribeToPush,
  unsubscribeFromPush,
} from '@/lib/push-client';

const STORAGE_ENABLED = 'furmosa-order-notify-enabled';
const STORAGE_LAST_CHECK = 'furmosa-order-notify-last-check';
const STORAGE_PUSH_MODE = 'furmosa-order-notify-push-mode';
const POLL_MS = 30_000;

type NotifyMode = 'push' | 'poll' | 'off';

type NewOrder = {
  id: string;
  orderNumber: string;
  total: number;
  source: string;
  orderedAt: string;
};

function supportsBrowserNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function readEnabled() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_ENABLED) === '1';
}

function writeEnabled(enabled: boolean) {
  window.localStorage.setItem(STORAGE_ENABLED, enabled ? '1' : '0');
}

function readNotifyMode(): NotifyMode {
  const raw = window.localStorage.getItem(STORAGE_PUSH_MODE);
  return raw === 'push' || raw === 'poll' ? raw : 'off';
}

function writeNotifyMode(mode: NotifyMode) {
  window.localStorage.setItem(STORAGE_PUSH_MODE, mode);
}

function readLastCheck() {
  const raw = window.localStorage.getItem(STORAGE_LAST_CHECK);
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString();
}

function writeLastCheck(iso: string) {
  window.localStorage.setItem(STORAGE_LAST_CHECK, iso);
}

function notifyOrder(order: NewOrder) {
  if (!supportsBrowserNotifications() || Notification.permission !== 'granted') return;

  const source = orderSourceLabel[order.source] ?? order.source;
  const notification = new Notification(`新訂單 ${order.orderNumber}`, {
    body: `${source} · ${formatCurrency(order.total)}`,
    tag: order.id,
    icon: '/icons/icon.svg',
  });

  notification.onclick = () => {
    window.focus();
    window.location.href = `/orders/${order.id}`;
    notification.close();
  };
}

export function OrderNotificationBell() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [notifyMode, setNotifyMode] = useState<NotifyMode>('off');
  const [isStandalone, setIsStandalone] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [recentOrders, setRecentOrders] = useState<NewOrder[]>([]);
  const [statusText, setStatusText] = useState('');
  const pollingRef = useRef<number | null>(null);

  const poll = useCallback(async () => {
    if (!readEnabled() || readNotifyMode() !== 'poll') return;

    try {
      const since = readLastCheck();
      const res = await fetch(`/api/notifications/new-orders?since=${encodeURIComponent(since)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;

      const data = (await res.json()) as { orders: NewOrder[]; serverTime: string };
      if (data.orders.length > 0) {
        setRecentOrders((prev) => {
          const seen = new Set(prev.map((o) => o.id));
          const merged = [...data.orders.filter((o) => !seen.has(o.id)), ...prev].slice(0, 8);
          return merged;
        });
        for (const order of data.orders) {
          notifyOrder(order);
        }
      }
      if (data.serverTime) writeLastCheck(data.serverTime);
    } catch {
      // 網路中斷時略過
    }
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current != null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    void poll();
    pollingRef.current = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') void poll();
    }, POLL_MS);
  }, [poll, stopPolling]);

  useEffect(() => {
    setIsStandalone(isStandaloneDisplayMode());
    if (!supportsBrowserNotifications()) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);
    const initialEnabled = readEnabled();
    const initialMode = readNotifyMode();
    setEnabled(initialEnabled);
    setNotifyMode(initialMode);
    if (initialEnabled && initialMode === 'poll' && Notification.permission === 'granted') {
      startPolling();
    }
    return stopPolling;
  }, [startPolling, stopPolling]);

  useEffect(() => {
    if (!enabled) {
      setStatusText('關閉中');
      return;
    }
    if (permission === 'denied') {
      setStatusText('通知被系統封鎖，請到設定允許');
      return;
    }
    if (notifyMode === 'push') {
      setStatusText(
        isStandalone
          ? '已開啟 · 主畫面 App 推播（App 關閉也可收到）'
          : '已開啟 · Web Push 推播',
      );
      return;
    }
    if (notifyMode === 'poll' && permission === 'granted') {
      setStatusText('已開啟 · 每 30 秒檢查（需保持 App 開啟）');
      return;
    }
    setStatusText('請允許通知權限');
  }, [enabled, notifyMode, permission, isStandalone]);

  async function enableNotifications() {
    if (!supportsBrowserNotifications()) return;

    try {
      const keyRes = await fetch('/api/notifications/vapid-public-key', { cache: 'no-store' });
      const keyData = (await keyRes.json()) as { configured?: boolean; publicKey?: string | null };

      if (keyData.configured && keyData.publicKey && 'serviceWorker' in navigator) {
        await subscribeToPush(keyData.publicKey);
        writeEnabled(true);
        writeNotifyMode('push');
        writeLastCheck(new Date().toISOString());
        setEnabled(true);
        setNotifyMode('push');
        setPermission('granted');
        stopPolling();
        return;
      }
    } catch {
      // 改走輪詢備援
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== 'granted') {
      writeEnabled(false);
      writeNotifyMode('off');
      setEnabled(false);
      setNotifyMode('off');
      stopPolling();
      return;
    }

    writeEnabled(true);
    writeNotifyMode('poll');
    writeLastCheck(new Date().toISOString());
    setEnabled(true);
    setNotifyMode('poll');
    startPolling();
  }

  async function disableNotifications() {
    if (readNotifyMode() === 'push') {
      await unsubscribeFromPush().catch(() => {});
    }
    writeEnabled(false);
    writeNotifyMode('off');
    setEnabled(false);
    setNotifyMode('off');
    stopPolling();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl"
          aria-label="新訂單通知"
        >
          {enabled && permission === 'granted' ? (
            <BellRing className="h-4 w-4 text-primary" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {recentOrders.length > 0 ? (
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>新訂單通知</DropdownMenuLabel>
        <p className="px-2 pb-2 text-[11px] leading-relaxed text-muted-foreground">{statusText}</p>
        {isStandalone ? (
          <p className="px-2 pb-2 text-[11px] text-primary">已從主畫面圖示開啟</p>
        ) : null}
        <DropdownMenuSeparator />
        {permission === 'unsupported' ? (
          <p className="px-2 py-2 text-xs text-muted-foreground">此瀏覽器不支援通知。</p>
        ) : enabled ? (
          <DropdownMenuItem onClick={() => void disableNotifications()}>關閉通知</DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => void enableNotifications()}>開啟通知</DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <div className="space-y-1 px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
          <p className="font-medium text-foreground">主畫面 App 使用方式</p>
          <p>1. 用 Safari／Chrome 開啟後台，加入主畫面。</p>
          <p>2. 從主畫面圖示進入，點 🔔 開啟通知並允許。</p>
          <p>3. 之後有新訂單會推播，即使 App 在背景也可收到（iOS 16.4+）。</p>
        </div>
        {recentOrders.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
              最近偵測到
            </DropdownMenuLabel>
            {recentOrders.map((order) => (
              <DropdownMenuItem key={order.id} asChild>
                <Link href={`/orders/${order.id}`} onClick={() => setOpen(false)}>
                  <span className="font-medium">{order.orderNumber}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatCurrency(order.total)}
                  </span>
                </Link>
              </DropdownMenuItem>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
