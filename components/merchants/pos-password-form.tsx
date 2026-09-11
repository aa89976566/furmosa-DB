'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { submitPasswordResetWithReceipt, type PasswordResetReceipt } from '@/lib/pos/password-reset-receipt';
import { isNextRedirect } from '@/lib/is-next-redirect';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { resetPosPasswordWithFeedback, type PosPasswordState } from '@/app/(main)/merchants/[id]/pos-password-action';

type PosUser = { id: string; username: string; isActive: boolean };
const initialState: PosPasswordState = { status: 'idle', message: '' };

function PasswordFields({ users, visible, toggle }: { users: PosUser[]; visible: boolean; toggle: () => void }) {
  const { pending } = useFormStatus();
  return (
    <fieldset disabled={pending} className="space-y-3 disabled:opacity-60">
      {users.length === 1 ? (
        <>
          <input type="hidden" name="userId" value={users[0].id} />
          <p className="text-sm">重設帳號：<span className="font-mono">{users[0].username}</span></p>
        </>
      ) : (
        <label className="block space-y-1 text-sm">
          <span>選擇要重設的帳號</span>
          <select name="userId" required defaultValue="" className="h-11 w-full rounded-md border bg-background px-3">
            <option value="" disabled>請選擇帳號</option>
            {users.map((user) => <option key={user.id} value={user.id}>{user.username}（{user.isActive ? '已啟用' : '已停用'}）</option>)}
          </select>
        </label>
      )}
      <label className="block space-y-1 text-sm">
        <span>新密碼（8–64 位）</span>
        <Input name="password" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={64} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" size="sm" aria-pressed={visible} onClick={toggle}>
          {visible ? '隱藏新密碼' : '顯示新密碼'}
        </Button>
        <Button type="submit" size="sm" variant="outline">{pending ? '重設中…' : '重設 POS 密碼'}</Button>
      </div>
    </fieldset>
  );
}

export function PosPasswordForm({ merchantId, users }: { merchantId: string; users: PosUser[] }) {
  const [receipt, setReceipt] = useState<PasswordResetReceipt | null>(null);
  const [state, action] = useFormState(async (previous: PosPasswordState, data: FormData) => {
    setReceipt(null);
    try {
      const result = await submitPasswordResetWithReceipt(previous, data, users, resetPosPasswordWithFeedback);
      setReceipt(result.receipt);
      return result.state;
    } catch (error) {
      if (isNextRedirect(error)) throw error;
      return { status: 'error' as const, message: '無法確認密碼是否更新，請先嘗試登入；若仍失敗，請重新設定。' };
    }
  }, initialState);
  const [visible, setVisible] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === 'success') {
      form.current?.reset();
      setVisible(false);
    }
  }, [state]);
  return (
    <form ref={form} action={action} className="mt-3 space-y-3">
      <input type="hidden" name="merchantId" value={merchantId} />
      {receipt ? (
        <section aria-label="本次設定的登入資料" className="space-y-2 rounded-lg border bg-muted/40 p-3">
          <p className="text-sm font-medium">已設定帳號：<span className="font-mono">{receipt.username}</span></p>
          <p className="text-sm">密碼：</p>
          <p className="select-text whitespace-pre-wrap break-all rounded-md bg-background p-3 font-mono text-lg">{receipt.password}</p>
          <p className="text-xs text-muted-foreground">請抄下本次設定的密碼，離開或重新整理頁面後將不再顯示。</p>
          <Button type="button" size="sm" variant="ghost" onClick={() => setReceipt(null)}>隱藏已設定密碼</Button>
        </section>
      ) : (
        <p className="text-xs text-muted-foreground">原密碼無法查回。輸入新密碼並重設成功後，密碼會直接顯示在帳號下方。</p>
      )}
      <PasswordFields users={users} visible={visible} toggle={() => setVisible((value) => !value)} />
      {state.message ? <p role={state.status === 'error' ? 'alert' : 'status'} className="rounded-lg border bg-muted/40 p-3 text-sm">{state.message}</p> : null}
    </form>
  );
}
