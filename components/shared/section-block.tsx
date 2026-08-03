import * as React from 'react';
import { cn } from '@/lib/utils';
import type { SectionTone } from '@/lib/section-tone';

interface SectionBlockProps {
  tone: SectionTone;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function SectionBlock({
  title,
  description,
  action,
  children,
  className,
}: SectionBlockProps) {
  return (
    <section className={cn('space-y-5', className)}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
