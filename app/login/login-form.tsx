'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { readRememberedHqEmail, writeRememberedHqEmail } from '@/lib/hq/remembered-email';

export function LoginForm({
  next,
  error,
  email,
}: {
  next?: string;
  error?: string;
  email?: string;
}) {
  const [emailValue, setEmailValue] = useState(email ?? '');

  useEffect(() => {
    if (email) {
      writeRememberedHqEmail(email, window.localStorage);
      setEmailValue(email);
      return;
    }
    const saved = readRememberedHqEmail(window.localStorage);
    if (saved) setEmailValue(saved);
  }, [email]);

  return (
    <Card>
      <CardContent className="p-6">
        <form
          action="/login/submit"
          method="post"
          autoComplete="on"
          className="space-y-4"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const value = String(new FormData(form).get('email') ?? '');
            writeRememberedHqEmail(value, window.localStorage);
          }}
        >
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
              value={emailValue}
              onChange={(event) => setEmailValue(event.target.value)}
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
          </div>
          {error ? (
            <p className="whitespace-pre-line rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            登入後這台電腦會保持登入。下次若回到這一頁，Email 會自動填好；密碼請讓瀏覽器記住。
          </p>
          <Button type="submit" className="w-full">
            登入
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
