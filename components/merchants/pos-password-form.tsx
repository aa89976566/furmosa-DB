'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
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
  const [state, action] = useFormState(resetPosPasswordWithFeedback, initialState);
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
      <p className="text-xs text-muted-foreground">原密碼無法查回。請先輸入新密碼，再按重設；成功後原密碼將失效。</p>
      <PasswordFields users={users} visible={visible} toggle={() => setVisible((value) => !value)} />
      {state.message ? <p role={state.status === 'error' ? 'alert' : 'status'} className="rounded-lg border bg-muted/40 p-3 text-sm">{state.message}</p> : null}
    </form>
  );
}
