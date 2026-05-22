'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { MerchantReportPeriod } from '@/lib/merchant-report';

export function MerchantsPeriodSwitch({ value }: { value: MerchantReportPeriod }) {
  const options: { key: MerchantReportPeriod; label: string }[] = [
    { key: 'week', label: '本週' },
    { key: 'month', label: '本月' },
  ];

  return (
    <div className="inline-flex rounded-lg border bg-muted/30 p-1">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <Link
            key={option.key}
            href={`/merchants?period=${option.key}`}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
