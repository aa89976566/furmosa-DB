import * as React from 'react';
import { cn } from '@/lib/utils';
import { sectionToneStyles, type SectionTone } from '@/lib/section-tone';

interface SectionBlockProps {
  tone: SectionTone;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionBlock({
  tone,
  title,
  description,
  action,
  children,
  className,
}: SectionBlockProps) {
  const styles = sectionToneStyles[tone];

  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn('mt-1 h-9 w-1.5 shrink-0 rounded-full', styles.marker)} />
          <div className="space-y-2">
            <span
              className={cn(
                'inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]',
                styles.chip,
              )}
            >
              {styles.label}
            </span>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-navy">{title}</h2>
              {description ? (
                <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
