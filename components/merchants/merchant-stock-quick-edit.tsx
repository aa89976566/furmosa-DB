'use client';

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adjustMerchantStock } from '@/app/(main)/merchants/[id]/actions';

export function MerchantStockQuickEdit({
  merchantId,
  productId,
  productName,
  quantity,
  returnTo,
  tierId,
  tierLabel,
}: {
  merchantId: string;
  productId: string;
  productName: string;
  quantity: number;
  returnTo?: string;
  tierId?: string;
  tierLabel?: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(String(quantity));
  const [pending, startTransition] = useTransition();

  const numberClass =
    quantity === 0
      ? 'font-mono font-semibold text-destructive'
      : quantity <= 3
        ? 'font-mono font-semibold text-warning'
        : 'font-mono font-semibold';

  function submit() {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      alert('請輸入 0 或正整數');
      return;
    }
    if (next === quantity) {
      setEditing(false);
      return;
    }
    const label = tierLabel ? `${productName}（${tierLabel}）` : productName;
    if (next < quantity) {
      const diff = quantity - next;
      if (
        !confirm(
          `「${label}」庫存將從 ${quantity} 改為 ${next}。\n少的 ${diff} 件會記為賣出並納入月結，確定嗎？`,
        )
      ) {
        return;
      }
    } else if (next > quantity) {
      if (
        !confirm(
          `「${label}」庫存將從 ${quantity} 改為 ${next}。\n實際送達數量與系統不符時，可直接修正為現場盤點結果。確定嗎？`,
        )
      ) {
        return;
      }
    }
    const fd = new FormData();
    fd.set('merchantId', merchantId);
    fd.set('productId', productId);
    if (tierId) fd.set('tierId', tierId);
    fd.set('newQuantity', String(next));
    if (returnTo) fd.set('returnTo', returnTo);
    fd.set('note', `庫存表盤點：${quantity} → ${next}`);
    startTransition(() => {
      void adjustMerchantStock(fd);
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className={numberClass}>{quantity}</span>
        <button
          type="button"
          onClick={() => {
            setValue(String(quantity));
            setEditing(true);
          }}
          className="text-[11px] font-medium text-primary hover:underline"
        >
          修改／盤點
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        min={0}
        step={1}
        autoFocus
        disabled={pending}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-7 w-16 rounded-md border bg-background px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-success hover:bg-success/10"
        disabled={pending}
        onClick={submit}
      >
        <Check className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground"
        disabled={pending}
        onClick={() => setEditing(false)}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
