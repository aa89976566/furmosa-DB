import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { sectionToneStyles, type SectionTone } from '@/lib/section-tone';

interface SectionCardProps {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: LucideIcon;
  tone?: SectionTone;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function SectionCard({
  id,
  title,
  description,
  action,
  icon: Icon,
  tone,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  const styles = tone ? sectionToneStyles[tone] : null;

  return (
    <Card
      id={id}
      className={cn(
        'overflow-hidden shadow-xs',
        styles?.card,
        styles?.cardBorder,
        className,
      )}
    >
      <CardHeader
        className={cn(
          'flex flex-row items-center justify-between space-y-0 border-b pb-3.5',
          styles?.header ?? 'border-border/60 bg-muted/30',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                styles?.icon ?? 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </div>
          ) : null}
          <div className="min-w-0 space-y-1">
            {tone ? (
              <span
                className={cn(
                  'inline-flex rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]',
                  styles?.chip,
                )}
              >
                {styles?.label}
              </span>
            ) : null}
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
        </div>
        {action}
      </CardHeader>
      <CardContent className={cn('pt-0', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
