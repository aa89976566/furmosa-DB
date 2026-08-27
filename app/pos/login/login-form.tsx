'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  readRememberedPosUsername,
  writeRememberedPosUsername,
} from '@/lib/pos/remembered-username';

export function PosLoginForm({
  next,
  error,
  username,
}: {
  next?: string;
  error?: string;
  username?: string;
}) {
  const [usernameValue, setUsernameValue] = useState(username ?? '');

  useEffect(() => {
    if (username) {
      writeRememberedPosUsername(username, window.localStorage);
      setUsernameValue(username);
      return;
    }
    const saved = readRememberedPosUsername(window.localStorage);
    if (saved) setUsernameValue(saved);
  }, [username]);

  return (
    <Card>
      <CardContent className="p-6">
        <form
          action="/pos/login/submit"
          method="post"
          autoComplete="on"
          className="space-y-4"
          onSubmit={(event) => {
            const form = event.currentTarget;
            const value = String(new FormData(form).get('username') ?? '');
            writeRememberedPosUsername(value, window.localStorage);
          }}
        >
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
              value={usernameValue}
              onChange={(event) => setUsernameValue(event.target.value)}
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
          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            登入後這台平板會保持登入。下次若回到這一頁，帳號會自動填好；密碼請讓瀏覽器記住。
          </p>
          <Button type="submit" className="h-11 w-full min-h-[44px]">
            登入
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
