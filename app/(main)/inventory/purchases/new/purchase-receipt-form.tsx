'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createPurchaseReceipt } from '../actions';

export function PurchaseReceiptForm({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState({ error: '', attempt: 0 });
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setPending(true);
    let completed = false;
    try {
      const result = await createPurchaseReceipt(state, data);
      if (result.receiptId) {
        completed = true;
        setState({ error: '', attempt: result.attempt });
        router.push(`/inventory/purchases/${encodeURIComponent(result.receiptId)}?created=1`);
        return;
      }
      setState(result);
    } catch {
      setState(previous => ({ error: '目前無法確認入庫結果，請稍後使用同一張表單重試，勿另建一筆。', attempt: previous.attempt + 1 }));
    } finally {
      if (!completed) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const acknowledge = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.error && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      acknowledge.current?.focus();
    }
  }, [state.attempt, state.error]);
  return <>
    <form onSubmit={submit} className="space-y-6 p-4 md:p-6" encType="multipart/form-data">
      {state.error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">{state.error}</p> : null}
      {children}
      <div className="sticky bottom-4 flex justify-end">
        <Button size="lg" type="submit" disabled={pending} aria-busy={pending}>{pending ? '正在確認入庫…' : '確認進貨並入庫'}</Button>
      </div>
    </form>
    <dialog ref={dialog} aria-labelledby="receipt-error-title" aria-describedby="receipt-error-detail" className="w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/40">
      <h2 id="receipt-error-title" className="text-lg font-semibold">無法完成入庫</h2>
      <p id="receipt-error-detail" className="mt-3 whitespace-pre-wrap text-sm">{state.error}</p>
      <p className="mt-3 text-sm text-muted-foreground">已保留您填寫的內容，請確認原因後再操作。</p>
      <div className="mt-5 flex justify-end"><Button ref={acknowledge} type="button" onClick={() => dialog.current?.close()}>知道了，返回表單</Button></div>
    </dialog>
  </>;
}
