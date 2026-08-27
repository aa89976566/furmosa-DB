'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  submitSelfSelectRestockAction,
  type PosRestockFormState,
} from '@/app/pos/restock/actions';

export type RestockProductOption = {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  suggestedQty: number;
};

const initial: PosRestockFormState = {};

export function RestockPicker({ products }: { products: RestockProductOption[] }) {
  const [qty, setQty] = useState<Record<string, number>>(() =>
    Object.fromEntries(products.map((p) => [p.id, p.suggestedQty])),
  );
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [state, action] = useFormState(submitSelfSelectRestockAction, initial);

  const selected = useMemo(
    () => products.filter((p) => (qty[p.id] ?? 0) > 0).map((p) => ({ ...p, count: qty[p.id] ?? 0 })),
    [products, qty],
  );
  const totalPieces = selected.reduce((sum, p) => sum + p.count, 0);

  if (products.length === 0) {
    return <p className="text-sm text-muted-foreground">目前沒有可補貨的商品。</p>;
  }

  if (step === 'confirm') {
    return (
      <div className="space-y-4">
        <button
          type="button"
          className="min-h-[44px] text-sm text-muted-foreground"
          onClick={() => setStep('edit')}
        >
          ← 返回修改數量
        </button>
        <ul className="space-y-3">
          {selected.map((p) => (
            <li key={p.id} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 shadow-card">
              <span className="font-medium text-navy">{p.name}</span>
              <span className="tabular-nums text-muted-foreground">× {p.count}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">共 {totalPieces} 件</p>
        <form action={action} className="space-y-3">
          {selected.map((p) => (
            <span key={p.id}>
              <input type="hidden" name="productId" value={p.id} />
              <input type="hidden" name="quantity" value={p.count} />
            </span>
          ))}
          {state.error ? (
            <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
          ) : null}
          <Submit label="送出補貨單" />
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-24">
      <ul className="space-y-3">
        {products.map((p) => {
          const value = qty[p.id] ?? 0;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-card"
            >
              <div className="min-w-0">
                <p className="font-medium text-navy">{p.name}</p>
                <p className="text-sm text-muted-foreground">
                  現在 {p.stockQty}
                  {p.suggestedQty > 0 ? `　建議補 ${p.suggestedQty}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-12 min-h-[48px] p-0 text-lg"
                  aria-label={`${p.name} 減少`}
                  onClick={() =>
                    setQty((prev) => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] ?? 0) - 1) }))
                  }
                >
                  −
                </Button>
                <span className="w-8 text-center text-lg font-semibold tabular-nums">{value}</span>
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 w-12 min-h-[48px] p-0 text-lg"
                  aria-label={`${p.name} 增加`}
                  onClick={() =>
                    setQty((prev) => ({ ...prev, [p.id]: (prev[p.id] ?? 0) + 1 }))
                  }
                >
                  ＋
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="fixed inset-x-0 bottom-[calc(52px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg px-4 md:static md:max-w-none md:px-0">
        <Button
          type="button"
          className="min-h-[52px] w-full text-base shadow-card"
          disabled={totalPieces === 0}
          onClick={() => setStep('confirm')}
        >
          確認補貨
        </Button>
      </div>
    </div>
  );
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="min-h-[52px] w-full text-base" disabled={pending}>
      {pending ? '送出中…' : label}
    </Button>
  );
}
