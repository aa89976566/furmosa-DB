'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  confirmRestockReceiptAction,
  type ConfirmRestockReceiptState,
} from './actions';

const initialState: ConfirmRestockReceiptState = { status: 'idle' };

function DialogActions({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus();
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Button type="submit" disabled={pending} className="min-h-[48px] sm:order-2">
        {pending ? '正在確認收貨…' : '確認完整收到'}
      </Button>
      <Button
        data-safe-cancel
        type="button"
        variant="outline"
        disabled={pending}
        onClick={onCancel}
        className="min-h-[48px] sm:order-1"
      >
        再檢查一下
      </Button>
    </div>
  );
}

export function ConfirmReceiptButton({ requestId }: { requestId: string }) {
  const [state, formAction] = useFormState(confirmRestockReceiptAction, initialState);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeDialog = () => dialogRef.current?.close();

  useEffect(() => {
    if (state.status !== 'idle') closeDialog();
  }, [state]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-background/70 p-3 text-sm">
        <p className="font-medium">請先核對品項、數量與商品狀況。</p>
        <p className="mt-1 text-muted-foreground">
          商品短少、破損或品項不符？請聯絡總部，先不要確認。
        </p>
      </div>
      <Button
        ref={triggerRef}
        type="button"
        disabled={state.status === 'just_received' || state.status === 'already_received'}
        className="min-h-[48px] w-full"
        onClick={() => {
          dialogRef.current?.showModal();
          requestAnimationFrame(() =>
            dialogRef.current?.querySelector<HTMLButtonElement>('[data-safe-cancel]')?.focus(),
          );
        }}
      >
        確認收到貨
      </Button>

      {state.status !== 'idle' ? (
        <p
          role={state.status === 'failed' ? 'alert' : 'status'}
          aria-live="polite"
          className={state.status === 'failed' ? 'text-sm text-destructive' : 'text-sm font-medium'}
        >
          {state.message}
        </p>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby="receipt-dialog-title"
        aria-describedby="receipt-dialog-description"
        onClose={() => triggerRef.current?.focus()}
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <form action={formAction} className="space-y-5 p-5">
          <input type="hidden" name="requestId" value={requestId} />
          <div>
            <h2 id="receipt-dialog-title" className="text-lg font-semibold">
              確認商品都已完整收到？
            </h2>
            <p id="receipt-dialog-description" className="mt-2 text-sm text-muted-foreground">
              確認後，這批商品會加入店內可銷售庫存。
            </p>
          </div>
          <DialogActions onCancel={closeDialog} />
        </form>
      </dialog>
    </div>
  );
}
