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
  const { state, idToken, error, retry } = useLiff(liffId, reconnectPath);
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

      {(state === 'loading' || state === 'slow') && (
        <div
          className={
            sunny
              ? 'rounded-3xl border-2 border-[#3f78bd] bg-white p-5 shadow-[6px_6px_0_#ffd84d]'
              : 'rounded-xl border bg-card p-5'
          }
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3">
            <span
              className={
                sunny
                  ? 'h-5 w-5 animate-spin rounded-full border-2 border-[#3f78bd]/25 border-t-[#3f78bd]'
                  : 'h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-foreground'
              }
              aria-hidden="true"
            />
            <div>
              <p className={sunny ? 'font-semibold text-[#17345f]' : 'font-medium text-foreground'}>
                正在開啟 LINE 登入
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                第一次使用可能需要確認 LINE 帳號，完成後會自動回到此頁。
              </p>
            </div>
          </div>

          {state === 'slow' && (
            <button
              type="button"
              onClick={retry}
              className={
                sunny
                  ? 'mt-5 min-h-11 w-full rounded-2xl bg-[#3f78bd] px-4 py-3 font-semibold text-white'
                  : 'mt-5 min-h-11 w-full rounded-lg bg-primary px-4 py-3 font-medium text-primary-foreground'
              }
            >
              重新連線 LINE
            </button>
          )}
        </div>
      )}

      {state === 'error' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive" role="alert">
          <p>{error ?? '無法開啟頁面'}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 min-h-11 rounded-lg border border-destructive/40 bg-background px-4 py-2 font-medium text-foreground"
          >
            重新連線 LINE
          </button>
        </div>
      )}

      {state === 'ready' && idToken && children({ idToken })}
    </div>
  );
}
