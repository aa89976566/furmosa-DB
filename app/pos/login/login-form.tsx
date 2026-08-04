'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { posLoginAction, type PosLoginState } from './actions';

const initialState: PosLoginState = {};

export function PosLoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(posLoginAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next ?? ''} />
      <div className="space-y-1.5">
        <label htmlFor="username" className="text-sm font-medium text-ink">
          帳號
        </label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          defaultValue={state.values?.username ?? ''}
          required
          className="h-12 rounded-xl border-border/80 bg-card text-base"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          密碼
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 rounded-xl border-border/80 bg-card text-base"
        />
      </div>
      {state.error ? (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full min-h-[48px] text-base" disabled={pending}>
      {pending ? '登入中…' : '登入'}
    </Button>
  );
}
