'use client';

import type { ReactNode } from 'react';
import { useLiff } from '@/components/liff/use-liff';

type Props = {
  liffId: string;
  title: string;
  reconnectPath?: string;
  variant?: 'default' | 'sunny';
  children: (ctx: { idToken: string }) => ReactNode;
};

export function LiffShell({ liffId, title, reconnectPath, variant = 'default', children }: Props) {
  const { state, idToken, error } = useLiff(liffId, reconnectPath);
  const sunny = variant === 'sunny';

  return (
    <div
      className={
        sunny
          ? 'mx-auto min-h-screen max-w-md bg-[#fffaf0] px-4 py-6 text-[#17345f]'
          : 'mx-auto min-h-screen max-w-md bg-background px-4 py-6'
      }
    >
      <header className="mb-6">
        <p
          className={
            sunny
              ? 'text-xs font-semibold uppercase tracking-[0.16em] text-[#2368b5]'
              : 'text-xs font-medium uppercase tracking-wide text-muted-foreground'
          }
        >
          FURMOSA 匠寵
        </p>
        <h1
          className={sunny ? 'mt-2 text-2xl font-bold tracking-tight text-[#17345f]' : 'mt-1 text-xl font-semibold text-foreground'}
        >
          {title}
        </h1>
        {sunny && <span className="mt-3 block h-2 w-24 -rotate-1 rounded-full bg-[#ffd84d]" aria-hidden="true" />}
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
