'use client';

import { useEffect, useRef } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { createPosUserWithFeedback, type PosPasswordState } from '@/app/(main)/merchants/[id]/pos-password-action';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { isNextRedirect } from '@/lib/is-next-redirect';

function AccountFields() {
  const { pending } = useFormStatus();
  return <fieldset disabled={pending} className="space-y-3 disabled:opacity-60">
    <Input name="username" aria-label="POS 帳號" placeholder="POS 帳號" autoComplete="off" required minLength={4} maxLength={32} />
    <Input name="password" aria-label="密碼（至少 8 位）" type="password" placeholder="密碼（至少 8 位）" autoComplete="new-password" required minLength={8} maxLength={64} />
    <Button type="submit" size="sm">{pending ? '建立中…' : '建立 POS 帳號'}</Button>
  </fieldset>;
}

export function PosAccountForm({ merchantId }: { merchantId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const acknowledge = useRef<HTMLButtonElement>(null);
  const [state, action] = useFormState(async (previous: PosPasswordState, data: FormData): Promise<PosPasswordState> => {
    try { return await createPosUserWithFeedback(previous, data); }
    catch (error) {
      if (isNextRedirect(error)) throw error;
      return { status: 'error', message: '無法確認帳號是否建立，請重新整理查看帳號清單，避免重複建立。' };
    }
  }, { status: 'idle', message: '' } as PosPasswordState);
  useEffect(() => {
    if (state.status === 'error') {
      if (!dialog.current?.open) dialog.current?.showModal();
      acknowledge.current?.focus();
    }
  }, [state]);
  return <>
    <form action={action} className="mt-3 space-y-3">
      <input type="hidden" name="merchantId" value={merchantId} />
      <AccountFields />
      <p role={state.status === 'error' ? 'alert' : 'status'} aria-live="polite" className="text-sm">{state.message}</p>
    </form>
    <dialog ref={dialog} aria-labelledby="pos-account-error-title" aria-describedby="pos-account-error-message" className="w-[calc(100%-2rem)] max-w-md rounded-xl border bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40">
      <h2 id="pos-account-error-title" className="text-lg font-semibold">無法建立 POS 帳號</h2>
      <p id="pos-account-error-message" className="my-4 text-sm">{state.message}</p>
      <Button ref={acknowledge} type="button" onClick={() => dialog.current?.close()}>我知道了</Button>
    </dialog>
  </>;
}
