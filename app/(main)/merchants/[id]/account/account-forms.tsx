'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createMerchantAccountAction,
  resetMerchantPasswordAction,
  setMerchantAccountActiveAction,
} from './actions';

const initialState = { message: '' };

function SubmitButton({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'outline' | 'destructive' }) {
  const { pending } = useFormStatus();
  return <Button type="submit" variant={variant} disabled={pending}>{pending ? '處理中…' : children}</Button>;
}

function Result({ state }: { state: { message: string; ok?: boolean } }) {
  if (!state.message) return null;
  return <p role="status" className={state.ok ? 'text-sm text-success' : 'text-sm text-destructive'}>{state.message}</p>;
}

function PasswordFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm font-medium">密碼
        <Input name="password" type="password" minLength={4} maxLength={8} autoComplete="new-password" required />
      </label>
      <label className="space-y-2 text-sm font-medium">再次輸入密碼
        <Input name="passwordConfirmation" type="password" minLength={4} maxLength={8} autoComplete="new-password" required />
      </label>
    </div>
  );
}

export function CreateMerchantAccountForm({ merchantId }: { merchantId: string }) {
  const [state, action] = useFormState(createMerchantAccountAction, initialState);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="merchantId" value={merchantId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium">登入帳號
          <Input name="username" minLength={4} maxLength={32} autoCapitalize="none" autoComplete="off" placeholder="例如：store.taipei" required />
        </label>
        <label className="space-y-2 text-sm font-medium">使用者名稱
          <Input name="displayName" maxLength={40} autoComplete="off" placeholder="例如：門市店長" />
        </label>
      </div>
      <PasswordFields />
      <p className="text-xs leading-relaxed text-muted-foreground">密碼需為 4–8 個字元。請用安全方式交給店家，不要透過公開群組傳送。</p>
      <Result state={state} />
      <SubmitButton>開通 POS 帳號</SubmitButton>
    </form>
  );
}

export function ExistingMerchantAccountForms({ merchantId, accountId, isActive }: { merchantId: string; accountId: string; isActive: boolean }) {
  const [passwordState, passwordAction] = useFormState(resetMerchantPasswordAction, initialState);
  const [activeState, activeAction] = useFormState(setMerchantAccountActiveAction, initialState);
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form action={passwordAction} className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
        <input type="hidden" name="merchantId" value={merchantId} />
        <input type="hidden" name="accountId" value={accountId} />
        <div><h3 className="font-semibold">重設密碼</h3><p className="mt-1 text-sm text-muted-foreground">更新後，店家下次登入需使用新密碼。</p></div>
        <PasswordFields />
        <Result state={passwordState} />
        <SubmitButton variant="outline">更新密碼</SubmitButton>
      </form>
      <form action={activeAction} className="space-y-4 rounded-xl border border-border/70 bg-card p-5">
        <input type="hidden" name="merchantId" value={merchantId} />
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="nextActive" value={String(!isActive)} />
        <div><h3 className="font-semibold">帳號狀態</h3><p className="mt-1 text-sm text-muted-foreground">{isActive ? '停用後，現有 POS 工作階段也會失效。' : '重新啟用後，店家可再次登入 POS。'}</p></div>
        <Result state={activeState} />
        <SubmitButton variant={isActive ? 'destructive' : 'default'}>{isActive ? '停用 POS 帳號' : '重新啟用帳號'}</SubmitButton>
      </form>
    </div>
  );
}
