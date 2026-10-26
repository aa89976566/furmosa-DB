'use client';

import { useEffect, useRef } from 'react';
import { useFormState } from 'react-dom';
import { Button } from '@/components/ui/button';
import { createPurchaseReceipt } from '../actions';

export function PurchaseReceiptForm({ children }: { children: React.ReactNode }) {
  const [state, action] = useFormState(createPurchaseReceipt, { error: '', attempt: 0 });
  const dialog = useRef<HTMLDialogElement>(null);
  const acknowledge = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.error && dialog.current && !dialog.current.open) {
      dialog.current.showModal();
      acknowledge.current?.focus();
    }
  }, [state.attempt, state.error]);
  return <>
    <form action={action} onReset={event => event.preventDefault()} className="space-y-6 p-4 md:p-6" encType="multipart/form-data">
      {state.error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">{state.error}</p> : null}
      {children}
    </form>
    <dialog ref={dialog} aria-labelledby="receipt-error-title" aria-describedby="receipt-error-detail" className="w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/40">
      <h2 id="receipt-error-title" className="text-lg font-semibold">無法完成入庫</h2>
      <p id="receipt-error-detail" className="mt-3 whitespace-pre-wrap text-sm">{state.error}</p>
      <p className="mt-3 text-sm text-muted-foreground">請確認原因後再操作；若附件未保留，請重新選取。</p>
      <div className="mt-5 flex justify-end"><Button ref={acknowledge} type="button" onClick={() => dialog.current?.close()}>知道了，返回表單</Button></div>
    </dialog>
  </>;
}
