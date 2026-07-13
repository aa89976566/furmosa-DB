'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { adjustMerchantStock } from '@/app/(main)/merchants/[id]/actions';
import { isNextRedirect } from '@/lib/is-next-redirect';

type QuickEditState = { error?: string };

async function submitQuickEdit(
  _prev: QuickEditState,
  formData: FormData,
): Promise<QuickEditState> {
  try {
    await adjustMerchantStock(formData);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    return {
      error: error instanceof Error ? error.message : '儲存失敗，請稍後再試',
    };
  }
  return {};
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="icon"
      variant="ghost"
      className="h-7 w-7 text-success hover:bg-success/10"
      disabled={pending || disabled}
    >
      <Check className="h-4 w-4" />
    </Button>
  );
}

export function MerchantStockQuickEdit({
  merchantId,
  productId,
  productName,
  quantity,
  returnTo,
  tierId = '',
  tierLabel,
  align = 'end',
}: {
  merchantId: string;
  productId: string;
  productName: string;
  quantity: number;
  returnTo?: string;
  tierId?: string;
  tierLabel?: string | null;
  align?: 'start' | 'end';
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(String(quantity));
  const [state, formAction] = useFormState(submitQuickEdit, {});

  const numberClass =
    quantity === 0
      ? 'font-mono font-semibold text-destructive'
      : quantity <= 3
        ? 'font-mono font-semibold text-warning'
        : 'font-mono font-semibold';

  const alignClass = align === 'start' ? 'items-start' : 'items-end';

  function validateBeforeSubmit(): boolean {
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      alert('請輸入 0 或正整數');
      return false;
    }
    if (next === quantity) {
      setEditing(false);
      return false;
    }
    const label = tierLabel ? `${productName}（${tierLabel}）` : productName;
    if (next < quantity) {
      const diff = quantity - next;
      if (
        !confirm(
          `「${label}」庫存將從 ${quantity} 改為 ${next}。\n少的 ${diff} 件會記為賣出並納入月結，確定嗎？`,
        )
      ) {
        return false;
      }
    } else if (
      !confirm(
        `「${label}」庫存將從 ${quantity} 改為 ${next}。\n實際送達數量與系統不符時，可直接修正為現場盤點結果。確定嗎？`,
      )
    ) {
      return false;
    }
    return true;
  }

  if (!editing) {
    return (
      <div className={`flex flex-col gap-0.5 ${alignClass}`}>
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
    <form
      action={formAction}
      className={`flex flex-col gap-1 ${alignClass}`}
      onSubmit={(e) => {
        if (!validateBeforeSubmit()) {
          e.preventDefault();
          return;
        }
      }}
    >
      <input type="hidden" name="merchantId" value={merchantId} />
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="tierId" value={tierId} />
      <input type="hidden" name="newQuantity" value={value} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <input
        type="hidden"
        name="note"
        value={`庫存表盤點：${quantity} → ${value}`}
      />
      <div className={`flex items-center gap-1 ${align === 'start' ? '' : 'justify-end'}`}>
        <input
          type="number"
          min={0}
          step={1}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
          }}
          className="h-7 w-16 rounded-md border bg-background px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <SubmitButton />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground"
          onClick={() => setEditing(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      {state.error ? (
        <p className="text-[11px] text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}
