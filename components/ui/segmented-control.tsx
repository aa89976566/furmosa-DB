'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  title?: string;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  disabled = false,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      className={cn(
        'inline-flex flex-wrap gap-0.5 rounded-lg border border-border/80 bg-muted/30 p-0.5',
        className,
      )}
    >
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          variant={value === opt.value ? 'default' : 'ghost'}
          size="sm"
          disabled={disabled || opt.disabled}
          title={opt.title}
          className={cn(
            'rounded-md shadow-none',
            value !== opt.value && 'text-muted-foreground hover:text-foreground',
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}
