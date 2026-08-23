'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { posLoginAction, type PosLoginState } from './actions';

const initialState: PosLoginState = {};

export function PosLoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(posLoginAction, initialState);

  return (
    <Card className="border-[#e7e5e4] bg-white shadow-none">
      <CardContent className="p-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ''} />
          <div className="space-y-1.5">
            <label htmlFor="username" className="text-sm font-medium">
              帳號
            </label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              defaultValue={state.values?.username ?? ''}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              密碼
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-11"
            />
          </div>
          {state.error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-11 min-h-[44px] w-full bg-[#191919] hover:bg-black" disabled={pending}>
      {pending ? '登入中…' : '登入'}
    </Button>
  );
}
