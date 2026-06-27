'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';

type DiscountMode = 'amount' | 'percent';

function clampDiscount(amount: number, subtotal: number) {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (subtotal > 0) return Math.min(amount, subtotal);
  return amount;
}

function percentToDiscount(subtotal: number, percent: number) {
  if (subtotal <= 0 || !Number.isFinite(percent) || percent <= 0) return 0;
  return clampDiscount(Math.round((subtotal * percent) / 100), subtotal);
}

export function OrderDiscountField({
  subtotal,
  discount,
  onDiscountChange,
  name = 'discount',
  className,
}: {
  subtotal: number;
  discount: number;
  onDiscountChange: (amount: number) => void;
  name?: string;
  className?: string;
}) {
  const [mode, setMode] = useState<DiscountMode>('amount');
  const [percentInput, setPercentInput] = useState('');

  function switchMode(next: DiscountMode) {
    setMode(next);
    if (next === 'percent' && subtotal > 0 && discount > 0) {
      setPercentInput(String(Math.round((discount / subtotal) * 1000) / 10));
    }
  }

  function handlePercentChange(raw: string) {
    setPercentInput(raw);
    const pct = Number(raw);
    if (!raw.trim() || !Number.isFinite(pct) || pct <= 0) {
      onDiscountChange(0);
      return;
    }
    onDiscountChange(percentToDiscount(subtotal, pct));
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <input type="hidden" name={name} value={discount} />
      <div className="inline-flex rounded-md border bg-muted/40 p-0.5">
        {(
          [
            ['amount', '固定金額'],
            ['percent', '百分比'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchMode(key)}
            className={cn(
              'rounded px-2.5 py-1 text-[11px] font-medium transition-colors',
              mode === key
                ? 'bg-background text-navy shadow-sm'
                : 'text-muted-foreground hover:text-navy',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === 'amount' ? (
        <Input
          type="number"
          min={0}
          step="1"
          value={discount || ''}
          onChange={(e) =>
            onDiscountChange(clampDiscount(Number(e.target.value) || 0, subtotal))
          }
          placeholder="0"
          className="h-9 tabular-nums"
        />
      ) : (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={percentInput}
              onChange={(e) => handlePercentChange(e.target.value)}
              placeholder="例：10"
              className="h-9 tabular-nums"
            />
            <span className="shrink-0 text-sm text-muted-foreground">%</span>
          </div>
          {subtotal > 0 && discount > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              折 {formatCurrency(discount)}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
