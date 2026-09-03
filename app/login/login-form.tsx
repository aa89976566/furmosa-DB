'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <Card>
      <CardContent className="p-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? ''} />
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.values?.email ?? ''}
              required
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
            />
            <p className="text-xs text-muted-foreground">此裝置可保持登入 180 天；主動登出後立即失效。</p>
          </div>
          {state.error ? (
            <p className="whitespace-pre-line rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
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
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? '登入中…' : '登入'}
    </Button>
  );
}
