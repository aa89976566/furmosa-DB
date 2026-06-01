import * as React from 'react';
import { cn } from '@/lib/utils';
import { sectionToneStyles, type SectionTone } from '@/lib/section-tone';

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  tone?: SectionTone;
}

export function PageHeader({ title, description, actions, tone }: PageHeaderProps) {
  const styles = tone ? sectionToneStyles[tone] : null;

  return (
    <div
      className={cn(
        'border-b border-border/70 bg-card/80 px-4 py-5 backdrop-blur-sm sm:px-6 sm:py-6 md:py-7',
        tone && 'border-l-4',
        tone && styles?.cardBorder,
      )}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <p
            className={cn(
              'text-[11px] font-semibold uppercase tracking-[0.14em]',
              styles?.eyebrow ?? 'text-primary',
            )}
          >
            {styles?.label ?? 'Furmosa HQ'}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-navy md:text-3xl">{title}</h1>
          {description ? (
            <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
