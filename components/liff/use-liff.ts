'use client';

import { useEffect, useState } from 'react';
import { isLineIdTokenUsable } from '@/lib/line/id-token-client';

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
        if (!token || !isLineIdTokenUsable(token)) {
          // LIFF can retain an expired token while still claiming the user is
          // logged in. Clear it and let LINE issue a fresh token instead of
          // sending the stale token to our API and showing a generic 500.
          liff.logout();
          liff.login({ redirectUri: window.location.href });
          return;
        }
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
