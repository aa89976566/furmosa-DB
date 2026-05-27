'use client';

import type { ReactNode } from 'react';
import { useLiff } from '@/components/liff/use-liff';

type Props = {
  liffId: string;
  title: string;
  children: (ctx: { idToken: string }) => ReactNode;
};

export function LiffShell({ liffId, title, children }: Props) {
  const { state, idToken, error } = useLiff(liffId);

  return (
    <div className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">匠寵罐罐存款</p>
        <h1 className="mt-1 text-xl font-semibold text-foreground">{title}</h1>
      </header>

      {state === 'loading' && (
        <p className="text-sm text-muted-foreground">正在連線 LINE…</p>
      )}

      {state === 'error' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error ?? '無法開啟頁面'}
        </div>
      )}

      {state === 'ready' && idToken && children({ idToken })}
    </div>
  );
}
