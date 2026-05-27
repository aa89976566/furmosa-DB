'use client';

import { useEffect, useState } from 'react';

export type LiffState = 'loading' | 'ready' | 'error';

export function useLiff(liffId: string) {
  const [state, setState] = useState<LiffState>('loading');
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const liff = (await import('@line/liff')).default;
        await liff.init({ liffId });
        if (cancelled) return;

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const token = liff.getIDToken();
        if (!token) throw new Error('無法取得登入憑證，請關閉後從 LINE 重新開啟');
        setIdToken(token);
        setState('ready');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'LIFF 初始化失敗');
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [liffId]);

  return { state, idToken, error };
}
