'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const POLL_MS = 20_000;

type NewMember = {
  id: string;
  customerCode: string;
  name: string;
  petName: string | null;
  hasLine: boolean;
  startedAt: string;
};

/**
 * 輪詢新開戶（Web Polling，對齊訂單通知模式）。
 * 有新筆時提示並可一鍵 router.refresh()。
 */
export function JarSignupLiveRefresh({ className }: { className?: string }) {
  const router = useRouter();
  const sinceRef = useRef(new Date().toISOString());
  const [pending, setPending] = useState<NewMember[]>([]);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/notifications/new-jar-members?since=${encodeURIComponent(sinceRef.current)}`,
          { credentials: 'same-origin' },
        );
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          members?: NewMember[];
          serverTime?: string;
        };
        if (data.serverTime) sinceRef.current = data.serverTime;
        if (data.members?.length) {
          setPending((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const next = [...prev];
            for (const m of data.members!) {
              if (!ids.has(m.id)) next.push(m);
            }
            return next.slice(-12);
          });
        }
      } catch {
        // ignore transient network
      }
    }

    void poll();
    const id = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  function refreshNow() {
    setChecking(true);
    setPending([]);
    router.refresh();
    window.setTimeout(() => setChecking(false), 600);
  }

  if (pending.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>
        LINE 開戶會即時寫入本系統 · 每 20 秒檢查新會員
      </p>
    );
  }

  const latest = pending[pending.length - 1]!;

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl border border-primary/25 bg-primary/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-navy">
          有 {pending.length} 位新換罐開戶
        </p>
        <p className="truncate text-xs text-muted-foreground">
          最新：{latest.name}
          {latest.petName ? ` · ${latest.petName}` : ''}
          {latest.hasLine ? ' · LINE' : ''}
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        className="shrink-0 rounded-xl"
        disabled={checking}
        onClick={refreshNow}
      >
        <RefreshCw className={cn('mr-1.5 h-3.5 w-3.5', checking && 'animate-spin')} />
        更新畫面
      </Button>
    </div>
  );
}
