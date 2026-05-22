import * as React from 'react';
import { cn } from '@/lib/utils';

/** 寄賣店家子頁：淺灰底 + 區塊間固定間距（Monzo 式分區） */
export function MerchantWorkspace({
  children,
  className,
  narrow,
}: {
  children: React.ReactNode;
  className?: string;
  /** 表單類頁面較窄，閱讀更集中 */
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        'bg-canvas px-6 py-6',
        narrow ? 'mx-auto max-w-3xl' : 'mx-auto max-w-5xl',
        className,
      )}
    >
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** 單一邏輯區塊：白卡片 + 標題，可選步驟編號 */
export function MerchantSection({
  step,
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  step?: number;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-surface-raised shadow-card',
        className,
      )}
    >
      <header className="flex items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {step != null ? (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold tabular-nums text-primary"
              aria-hidden
            >
              {step}
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h2 className="text-base font-semibold tracking-tight text-navy">{title}</h2>
            {description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </header>
      <div className={cn('px-5 py-5', contentClassName)}>{children}</div>
    </section>
  );
}

export function MerchantStatGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3 sm:grid-cols-3', className)}>{children}</div>
  );
}

export function MerchantStat({
  label,
  value,
  suffix,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  tone?: 'default' | 'warning' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-warning'
        : 'text-navy';
  return (
    <div className="rounded-xl border border-border/60 bg-surface-raised px-4 py-3.5 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold tabular-nums tracking-tight', toneClass)}>
        {value}
        {suffix ? (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>
        ) : null}
      </p>
    </div>
  );
}

export function MerchantInfoStrip({
  items,
}: {
  items: { label: string; value: React.ReactNode }[];
}) {
  return (
    <dl className="grid gap-3 rounded-xl bg-muted/50 px-4 py-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {item.label}
          </dt>
          <dd className="mt-0.5 truncate text-sm font-medium text-navy">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function MerchantNotice({
  children,
  variant = 'neutral',
}: {
  children: React.ReactNode;
  variant?: 'neutral' | 'info';
}) {
  return (
    <p
      className={cn(
        'rounded-xl px-4 py-3 text-sm leading-relaxed',
        variant === 'info'
          ? 'bg-primary/5 text-muted-foreground'
          : 'bg-muted/60 text-muted-foreground',
      )}
    >
      {children}
    </p>
  );
}

export function MerchantFormActions({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MerchantField({
  label,
  required,
  hint,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function MerchantDlRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border/50 py-2.5 last:border-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium text-navy">{value}</dd>
    </div>
  );
}
