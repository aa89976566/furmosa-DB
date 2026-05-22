import * as React from 'react';
import { cn } from '@/lib/utils';

export type DetailStripItem = {
  label: string;
  value: React.ReactNode;
};

/** 橫向資訊條：多欄並排，標籤在上、內容在下 */
export function DetailStrip({
  items,
  columns = 2,
  className,
}: {
  items: DetailStripItem[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid gap-3 rounded-xl bg-muted/50 px-4 py-3',
        columns === 1 && 'grid-cols-1',
        columns === 3 && 'sm:grid-cols-3',
        columns === 2 && 'sm:grid-cols-2',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-navy">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** 單行橫向：圖示 + 文字，可並排多段 */
export function DetailInline({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function DetailInlinePart({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5 font-medium', className)}>
      {children}
    </span>
  );
}

export function DetailInlineSep() {
  return <span className="hidden text-muted-foreground/50 sm:inline" aria-hidden>
    ·
  </span>;
}

/** 狀態／標籤橫向排列 */
export function DetailBadgeRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
  );
}
