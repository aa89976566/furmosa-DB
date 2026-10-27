'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { RECEIPT_UNKNOWN_RESULT } from '@/lib/pos/receipt-feedback';
import { CheckCircle2, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { confirmDirectShipmentReceiptWithFeedback } from './actions';

type ShipmentItem = {
  id: string;
  productName: string;
  quantity: number;
  sku: string;
  weightGrams: number | null;
  unit: string | null;
};

function itemCheckKey(item: ShipmentItem) {
  return JSON.stringify([item.id, item.productName, item.quantity, item.sku, item.weightGrams, item.unit]);
}

function itemMeta(item: ShipmentItem) {
  const details = [item.sku ? `SKU ${item.sku}` : null, item.weightGrams ? `${item.weightGrams}g` : null, item.unit].filter(Boolean);
  return details.join(' · ') || '補貨品項';
}

export function ReceiptManifest({ shipmentId, items, canConfirmReceipt }: { shipmentId: string; items: ShipmentItem[]; canConfirmReceipt: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const acknowledge = useRef<HTMLButtonElement>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const checkedCount = items.filter((item) => checkedIds.includes(itemCheckKey(item))).length;
  const allChecked = items.length > 0 && checkedCount === items.length;
  const totalQuantity = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);

  function toggleItem(id: string) {
    setCheckedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!allChecked || !canConfirmReceipt || inFlight.current || completed) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setPending(true);
    setMessage('');
    let committed = false;
    try {
      const result = await confirmDirectShipmentReceiptWithFeedback(data);
      if (result.status !== 'error') {
        committed = true;
        setCompleted(true);
        setMessage(result.status === 'success' ? '收貨已完成，正在開啟結果。' : '正在開啟對應收貨單。');
        try { router.push(result.href); }
        catch { setMessage('收貨結果已確認，請重新整理查看最新狀態。'); }
        return;
      }
      setMessage(result.message);
    } catch (error) {
      if (isNextRedirect(error)) throw error;
      setMessage(RECEIPT_UNKNOWN_RESULT);
    } finally {
      if (!committed) inFlight.current = false;
      setPending(false);
    }
    dialog.current?.showModal();
    acknowledge.current?.focus();
  }

  return (
    <section className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_16px_44px_rgba(22,50,37,0.06)]">
      <div className="flex flex-col gap-1 border-b border-border px-5 py-5 sm:px-7">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">商品明細</h2>
        <p className="text-sm text-muted-foreground">請逐項核對實物、數量與商品狀況。</p>
      </div>
      {items.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground sm:px-7">尚未加入出貨品項</p> : (
        <div className="divide-y divide-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_84px_100px] gap-4 bg-muted/45 px-7 py-3 text-xs font-medium tracking-wide text-muted-foreground md:grid"><span>商品</span><span className="text-center">數量</span><span className="text-center">核對</span></div>
          {items.map((item) => {
            const isChecked = checkedIds.includes(itemCheckKey(item));
            return <label key={item.id} className="grid cursor-pointer gap-4 px-5 py-4 transition-colors hover:bg-muted/35 md:grid-cols-[minmax(0,1fr)_84px_100px] md:items-center md:px-7">
              <span className="flex min-w-0 items-center gap-4"><span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Package className="h-6 w-6" aria-hidden /></span><span className="min-w-0"><span className="block truncate font-medium text-foreground">{item.productName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{itemMeta(item)}</span></span></span>
              <span className="flex items-center justify-between text-sm md:justify-center"><span className="text-muted-foreground md:hidden">數量</span><span className="inline-flex min-w-10 justify-center rounded-full bg-muted px-3 py-1 font-semibold text-foreground">{item.quantity}</span></span>
              <span className="flex items-center justify-between md:justify-center"><span className="text-sm text-muted-foreground md:hidden">已核對</span><input type="checkbox" className="peer sr-only" checked={isChecked} onChange={() => toggleItem(itemCheckKey(item))} disabled={!canConfirmReceipt || pending || completed} /><span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-transparent transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"><CheckCircle2 className="h-5 w-5" aria-hidden /></span></span>
            </label>;
          })}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border bg-muted/25 px-5 py-4 text-sm sm:px-7"><span className="text-muted-foreground">{items.length} 項商品 · 共 {totalQuantity} 件</span>{canConfirmReceipt ? <span className="font-medium text-primary">已核對 {checkedCount}/{items.length} 項</span> : null}</div>
      {canConfirmReceipt ? <div className="border-t border-border px-5 py-5 sm:px-7"><form onSubmit={submit} aria-busy={pending}><input type="hidden" name="shipmentId" value={shipmentId} /><Button type="submit" disabled={!allChecked || pending || completed} className="group min-h-14 w-full rounded-2xl text-base shadow-[0_12px_26px_rgba(26,91,62,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(26,91,62,0.3)] active:translate-y-0 active:scale-[0.99]"><CheckCircle2 className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" aria-hidden />{completed ? '收貨已處理' : pending ? '確認入庫中…' : '收到這批貨，確認入庫'}</Button></form><p className="mt-3 text-center text-xs text-muted-foreground">確認後會立即加入店內庫存；若有不符，請先聯絡匠寵。</p></div> : null}
      {message ? <p role={completed ? 'status' : 'alert'} aria-live="polite" className="px-5 pb-5 text-sm">{message}</p> : null}
      <dialog ref={dialog} aria-labelledby="receipt-error-title" aria-describedby="receipt-error-message" className="w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40">
        <h2 id="receipt-error-title" className="text-lg font-semibold">無法確認收貨</h2>
        <p id="receipt-error-message" className="my-4 text-sm">{message}</p>
        <Button ref={acknowledge} type="button" onClick={() => dialog.current?.close()}>返回檢查</Button>
      </dialog>
    </section>
  );
}
