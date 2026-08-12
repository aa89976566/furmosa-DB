import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** POS 頁面外層：Monzo 式軟畫布＋輕微氛圍 */
export function PosPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('pos-scope relative px-4 pb-4 pt-5 sm:px-5', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(120%_80%_at_10%_-10%,hsl(var(--coral)/0.16),transparent_55%),radial-gradient(90%_60%_at_100%_0%,hsl(212_80%_48%/0.08),transparent_50%)]"
      />
      <div className="relative space-y-5">{children}</div>
    </div>
  );
}

/** 品牌＋店名為首屏主訊號 */
export function PosHomeHeader({
  merchantName,
  logoutAction,
}: {
  merchantName: string;
  logoutAction: () => Promise<void>;
}) {
  return (
    <header className="flex items-start justify-between gap-3 pos-fade-in">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-coral">
          Furmosa
        </p>
        <h1 className="mt-1 font-pos text-[1.75rem] font-semibold leading-tight tracking-tight text-navy">
          {merchantName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">今天 · 依序處理就好</p>
      </div>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="ghost"
          className="min-h-[44px] shrink-0 px-3 text-sm text-muted-foreground"
        >
          登出
        </Button>
      </form>
    </header>
  );
}

export function PosSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
      {children}
    </p>
  );
}

export function PosEmptyToday({
  primaryHref = '/pos/refill',
  secondaryHref = '/pos/restock',
}: {
  primaryHref?: string;
  secondaryHref?: string;
}) {
  return (
    <section className="pos-fade-in overflow-hidden rounded-[1.35rem] border border-border/60 bg-surface-raised p-6 shadow-card">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/10 text-success">
        <span className="text-lg font-semibold" aria-hidden>
          ✓
        </span>
      </div>
      <h2 className="mt-4 font-pos text-xl font-semibold tracking-tight text-navy">
        今天都處理好了
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        需要時再看換罐或叫貨就好。
      </p>
      <div className="mt-5 grid gap-2">
        <Button asChild className="min-h-[48px] w-full rounded-2xl text-base font-semibold">
          <Link href={primaryHref}>看換罐</Link>
        </Button>
        <Button
          asChild
          variant="outline"
          className="min-h-[48px] w-full rounded-2xl text-base font-semibold"
        >
          <Link href={secondaryHref}>去叫貨</Link>
        </Button>
      </div>
    </section>
  );
}

export function PosWarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
      {children}
    </div>
  );
}
