'use client';

import { useEffect, useState } from 'react';
import { isLineIdTokenUsable } from '@/lib/line/id-token-client';

export type LiffState = 'loading' | 'slow' | 'ready' | 'error';

export function useLiff(liffId: string, reconnectPath?: string) {
  const [state, setState] = useState<LiffState>('loading');
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setState('slow');
    }, 6_000);

    (async () => {
      try {
        const liff = (await import('@line/liff')).default;
        await liff.init({ liffId, withLoginOnExternalBrowser: true });
        if (cancelled) return;

        const reconnectUrl = new URL(
          reconnectPath ?? window.location.pathname,
          window.location.origin,
        ).toString();

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: reconnectUrl });
          return;
        }

        const token = liff.getIDToken();
        if (!token || !isLineIdTokenUsable(token)) {
          // LIFF can retain an expired token while still claiming the user is
          // logged in. Clear it and let LINE issue a fresh token instead of
          // sending the stale token to our API and showing a generic 500.
          liff.logout();
          window.location.replace(reconnectUrl);
          return;
        }
        setIdToken(token);
        setState('ready');
      } catch (e) {
        if (cancelled) return;

        const message = e instanceof Error ? e.message : 'LIFF 初始化失敗';
        if (/invalid authorization code/i.test(message)) {
          // LINE OAuth codes are single-use. A refresh/back navigation can
          // replay the old code, so discard every OAuth query parameter and
          // restart from the canonical LIFF route.
          const reconnectUrl = new URL(
            reconnectPath ?? window.location.pathname,
            window.location.origin,
          );
          window.location.replace(reconnectUrl.toString());
          return;
        }

        setError(message);
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [liffId, reconnectPath]);

  const retry = () => {
    const reconnectUrl = new URL(
      reconnectPath ?? window.location.pathname,
      window.location.origin,
    );
    window.location.replace(reconnectUrl.toString());
  };

  return { state, idToken, error, retry };
}
