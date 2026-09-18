'use client';

import { useEffect, useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Face ID 暫時無法使用');
  return data;
}

function destination(next?: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
}

export function PasskeyLoginButton({ next }: { next?: string }) {
  const [supported, setSupported] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setSupported(Boolean(window.PublicKeyCredential && navigator.credentials));
  }, []);

  if (!supported) return null;

  const login = async () => {
    setPending(true);
    setError('');
    try {
      const options = await responseJson(await fetch('/api/auth/passkeys/authenticate/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
      const authentication = await startAuthentication({ optionsJSON: options });
      await responseJson(await fetch('/api/auth/passkeys/authenticate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authentication),
      }));
      window.location.assign(destination(next));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Face ID 登入失敗';
      if (!/NotAllowedError|canceled|cancelled|取消/i.test(message)) setError(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />或<span className="h-px flex-1 bg-border" />
      </div>
      <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={login}>
        <ScanFace className="mr-2 h-4 w-4" />
        {pending ? '等待 Face ID…' : '使用 Face ID 登入'}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

