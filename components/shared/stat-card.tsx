import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    isPositive?: boolean;
  };
  accent?: 'primary' | 'success' | 'warning' | 'info' | 'destructive';
}

const accentClasses: Record<string, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  destructive: 'bg-destructive/10 text-destructive',
};

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  accent = 'primary',
}: StatCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-card-hover">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-semibold tracking-tight text-navy">{value}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
          {trend ? (
            <p
              className={cn(
                'text-xs font-medium',
                trend.isPositive ? 'text-success' : 'text-destructive',
              )}
            >
              {trend.isPositive ? '▲' : '▼'} {Math.abs(trend.value)}%
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              'flex h-11 w-11 items-center justify-center rounded-2xl',
              accentClasses[accent],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
