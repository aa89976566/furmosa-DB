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
    <section className={cn('animate-enter space-y-3', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn('h-1.5 w-1.5 rounded-full', styles.marker)} aria-hidden />
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {styles.label}
            </span>
          </div>
          <h2 className="text-base font-semibold tracking-tight text-navy md:text-lg">{title}</h2>
          {description ? (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
