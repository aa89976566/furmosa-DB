import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sectionToneStyles, type SectionTone } from '@/lib/section-tone';

/** 多個 section 橫向並排（一張卡片、欄位分隔） */
export function HorizontalSectionBand({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border/70 bg-card shadow-xs',
        className,
      )}
    >
      <div className="grid grid-cols-1 divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
        {children}
      </div>
    </div>
  );
}

export function HorizontalSectionPane({
  tone,
  icon: Icon,
  title,
  description,
  children,
  className,
  contentClassName,
}: {
  tone: SectionTone;
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const styles = sectionToneStyles[tone];

  return (
    <section className={cn('flex min-w-0 flex-col', className)}>
      <header
        className={cn(
          'flex items-start gap-3 border-b px-4 py-3.5',
          styles.header,
        )}
      >
        {Icon ? (
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
              styles.icon,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        ) : null}
        <div className="min-w-0 space-y-1">
          <span
            className={cn(
              'inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
              styles.chip,
            )}
          >
            {styles.label}
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-navy">{title}</h2>
          {description ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </header>
      <div className={cn('flex flex-1 flex-col px-4 py-4', contentClassName)}>{children}</div>
    </section>
  );
}
