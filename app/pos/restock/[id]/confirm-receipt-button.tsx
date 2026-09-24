'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { CheckCircle2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PosReceiptSupport } from '@/components/pos/receipt-support';
import { confirmRestockReceiptAction, type ConfirmRestockReceiptState } from './actions';

type ReceiptItem = {
  id: string;
  productName: string;
  quantity: number;
  sku: string;
  weightGrams: number | null;
  variantKey: string | null;
  unit: string | null;
};

const initialState: ConfirmRestockReceiptState = { status: 'idle' };

function itemMeta(item: ReceiptItem) {
  const specification = item.weightGrams
      ? `${item.weightGrams}g`
      : item.variantKey
        ? '規格已記錄'
        : '原始規格未記錄';
  return [item.sku ? `SKU ${item.sku}` : null, specification, item.unit]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' · ');
}

function SubmitButton({ enabled }: { enabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={!enabled || pending} className="min-h-14 w-full rounded-2xl bg-primary text-base text-primary-foreground shadow-sm hover:bg-primary/90">
      <CheckCircle2 className="h-5 w-5" aria-hidden />
      {pending ? '正在確認入庫…' : '確認全部收到並入庫'}
    </Button>
  );
}

export function ConfirmReceiptButton({ requestId, items, canConfirm = true }: { requestId: string; items: ReceiptItem[]; canConfirm?: boolean }) {
  const [state, formAction] = useFormState(confirmRestockReceiptAction, initialState);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const allChecked = items.length > 0 && checkedIds.length === items.length;
  const totalQuantity = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <section className="overflow-hidden rounded-3xl border-2 border-primary/15 bg-card shadow-sm">
      <div className="border-b border-border bg-primary/[0.04] px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-semibold text-foreground">本次應收商品</h2><p className="mt-1 text-sm text-muted-foreground">逐項核對品項、規格與數量。</p></div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">{checkedIds.length}/{items.length}</span>
        </div>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => {
          const checked = checkedIds.includes(item.id);
          return (
            <label key={item.id} className="flex cursor-pointer items-center gap-3 px-4 py-4 hover:bg-primary/[0.03]">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Package className="h-5 w-5" aria-hidden /></span>
              <span className="min-w-0 flex-1"><span className="block font-medium text-foreground">{item.productName}</span><span className="mt-0.5 block text-xs text-muted-foreground">{itemMeta(item)}</span></span>
              <span className="rounded-full bg-muted px-3 py-1 text-sm font-semibold text-foreground">{item.quantity}</span>
              <input type="checkbox" className="peer sr-only" checked={checked} disabled={!canConfirm} onChange={() => setCheckedIds((current) => current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id])} />
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-transparent peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40 peer-disabled:opacity-50"><CheckCircle2 className="h-5 w-5" aria-hidden /></span>
            </label>
          );
        })}
      </div>
      <div className="border-t border-border px-4 py-4">
        <p className="mb-4 text-sm text-muted-foreground">{items.length} 項商品・共 {totalQuantity} 件</p>
        {canConfirm ? (
          <form action={formAction} className="space-y-3"><input type="hidden" name="requestId" value={requestId} /><SubmitButton enabled={allChecked} />{!allChecked ? <p className="text-center text-xs text-muted-foreground">全部核對完成後才能入庫</p> : null}</form>
        ) : <p className="rounded-xl bg-muted px-3 py-3 text-sm text-muted-foreground">商品寄出後即可開始核對收貨。</p>}
        {state.status !== 'idle' ? <p role={state.status === 'failed' ? 'alert' : 'status'} className={state.status === 'failed' ? 'mt-3 text-sm text-destructive' : 'mt-3 text-sm font-medium text-primary'}>{state.message}</p> : null}
        <div className="mt-4"><PosReceiptSupport /></div>
      </div>
    </section>
  );
}
