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
    <div className="border-b border-border/60 bg-card/60 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <p
            className={cn(
              'font-display text-[11px] font-semibold uppercase tracking-[0.16em]',
              styles?.eyebrow ?? 'text-sage',
            )}
          >
            {styles?.label ?? 'Furmosa'}
          </p>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            {title}
          </h1>
          {description ? (
            <div className="max-w-2xl text-sm text-muted-foreground">{description}</div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
