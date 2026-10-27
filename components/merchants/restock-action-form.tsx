'use client';

import { useRef, useState, type ReactNode, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { restockMerchantWithFeedback } from '@/app/(main)/merchants/[id]/actions';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { RESTOCK_UNKNOWN_RESULT } from '@/lib/orders/restock-feedback';

export function RestockActionForm({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const acknowledge = useRef<HTMLButtonElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const data = new FormData(event.currentTarget);
    inFlight.current = true;
    setPending(true);
    setMessage('');
    try {
      const result = await restockMerchantWithFeedback(data);
      if (result.status === 'success') return;
      setMessage(result.message);
    } catch (error) {
      if (isNextRedirect(error)) throw error;
      setMessage(RESTOCK_UNKNOWN_RESULT);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
    dialog.current?.showModal();
    acknowledge.current?.focus();
  }
  return <>
    <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4 min-w-0">{children}</fieldset>
      {pending && <p role="status">建立中，請稍候…</p>}
      {message && <p role="alert">{message}</p>}
    </form>
    <dialog ref={dialog} aria-labelledby="restock-error-title" aria-describedby="restock-error-message" className="w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40">
      <h2 id="restock-error-title" className="text-lg font-semibold">無法建立出貨單</h2>
      <p id="restock-error-message" className="my-4 text-sm">{message}</p>
      <Button ref={acknowledge} type="button" onClick={() => dialog.current?.close()}>返回修改</Button>
    </dialog>
  </>;
}
