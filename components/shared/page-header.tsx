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
    <div className="border-b border-border/80 bg-card px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            {tone ? (
              <span className={cn('h-1.5 w-1.5 rounded-full', styles?.marker)} aria-hidden />
            ) : null}
            <p
              className={cn(
                'text-[11px] font-medium uppercase tracking-[0.12em]',
                styles?.eyebrow ?? 'text-muted-foreground',
              )}
            >
              {styles?.label ?? 'Furmosa HQ'}
            </p>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-navy md:text-2xl">{title}</h1>
          {description ? (
            <div className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
