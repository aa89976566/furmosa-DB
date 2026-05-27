import Link from 'next/link';
import { cn } from '@/lib/utils';

export function InfoField({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm leading-snug text-foreground">{children}</div>
    </div>
  );
}

export function SummaryTile({
  label,
  value,
  sub,
  accent,
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  href?: string;
}) {
  const inner = (
    <div
      className={cn(
        'flex h-full flex-col justify-center rounded-2xl border px-4 py-3 transition-colors',
        accent
          ? 'border-primary/30 bg-gradient-to-br from-primary/10 to-primary/[0.02]'
          : 'border-border/60 bg-card hover:border-border',
        href && 'hover:bg-muted/30',
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-navy">{value}</p>
      {sub ? <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {inner}
      </Link>
    );
  }
  return inner;
}

export function DetailNavLink({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 text-sm shadow-sm transition-all hover:border-primary/25 hover:shadow-md"
    >
      <span className="font-medium text-foreground">{label}</span>
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        {count !== undefined ? <span className="tabular-nums">{count} 筆</span> : null}
        <span className="text-primary">查看</span>
      </span>
    </Link>
  );
}

export function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
