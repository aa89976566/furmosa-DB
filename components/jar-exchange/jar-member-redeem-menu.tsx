'use client';

import { useCallback, useEffect, useId, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatNumber } from '@/lib/format';
import { adminRedeemReward } from '@/app/(main)/jar-exchange/actions';
import { cn } from '@/lib/utils';

export type RedeemRewardOption = {
  id: string;
  rewardName: string;
  pointsRequired: number;
  couponFaceValue: number;
};

export function JarMemberRedeemMenu({
  customerId,
  customerName,
  pointsBalance,
  rewards,
}: {
  customerId: string;
  customerName: string;
  pointsBalance: number;
  rewards: RedeemRewardOption[];
}) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number } | null>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = 280;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    setMenuStyle({ top: rect.bottom + 6, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open]);

  const redeem = async (rewardId: string) => {
    setMsg(null);
    setPending(true);
    try {
      const res = await adminRedeemReward(customerId, rewardId);
      if (res.ok) {
        setMsg(`已兌換 ${res.couponCode}，剩餘 ${formatNumber(res.balanceAfter)} 點`);
        setOpen(false);
        router.refresh();
      } else {
        setMsg(res.error);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '兌換失敗');
    } finally {
      setPending(false);
    }
  };

  const menu =
    open && menuStyle && mounted ? (
      <div
        id={menuId}
        ref={menuRef}
        role="menu"
        style={{ position: 'fixed', top: menuStyle.top, left: menuStyle.left, zIndex: 9999 }}
        className="w-[280px] rounded-lg border bg-card py-1 text-sm shadow-lg"
      >
        <div className="border-b px-3 py-2">
          <p className="font-medium text-foreground">{customerName}</p>
          <p className="text-xs text-muted-foreground">
            目前點數：{formatNumber(pointsBalance)} 點
          </p>
        </div>
        {rewards.length === 0 ? (
          <div className="space-y-2 px-3 py-3">
            <p className="text-xs text-muted-foreground">尚無可兌換禮品，請先至禮品兌換新增。</p>
            <Button type="button" variant="outline" size="sm" className="h-8 w-full text-xs" asChild>
              <Link href="/jar-exchange/manage?tab=rewards" onClick={() => setOpen(false)}>
                前往新增禮品
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="max-h-56 overflow-auto py-1">
            {rewards.map((r) => {
              const affordable = pointsBalance >= r.pointsRequired;
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={pending || !affordable}
                    className={cn(
                      'w-full px-3 py-2 text-left hover:bg-muted/60 disabled:cursor-not-allowed disabled:opacity-50',
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void redeem(r.id)}
                  >
                    <div className="font-medium">{r.rewardName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.pointsRequired} 點 · 券面額 {formatCurrency(r.couponFaceValue)}
                      {!affordable ? ' · 點數不足' : ''}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {rewards.length > 0 ? (
          <div className="border-t px-3 py-2">
            <Button type="button" variant="ghost" size="sm" className="h-7 w-full text-xs" asChild>
              <Link href="/jar-exchange/manage?tab=rewards" onClick={() => setOpen(false)}>
                管理禮品目錄
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <span className="inline-flex flex-col items-end">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) updatePosition();
            return next;
          });
          setMsg(null);
        }}
      >
        {pending ? '兌換中…' : '兌換（選擇禮品）'}
      </Button>

      {mounted && menu ? createPortal(menu, document.body) : null}

      {msg ? (
        <span className="mt-0.5 max-w-[200px] text-right text-[10px] leading-tight text-muted-foreground">
          {msg}
        </span>
      ) : null}
    </span>
  );
}
