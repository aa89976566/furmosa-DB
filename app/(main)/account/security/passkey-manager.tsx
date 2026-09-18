'use client';

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';

async function responseJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '無法完成 Face ID 設定');
  return data;
}

export function PasskeyManager() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const register = async () => {
    if (!window.PublicKeyCredential) {
      setError('此瀏覽器不支援 Face ID／Passkey');
      return;
    }
    setPending(true);
    setMessage('');
    setError('');
    try {
      const options = await responseJson(await fetch('/api/auth/passkeys/register/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
      const registration = await startRegistration({ optionsJSON: options });
      await responseJson(await fetch('/api/auth/passkeys/register/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registration),
      }));
      setMessage('Face ID 已啟用，下次登入可直接使用。');
      window.location.reload();
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : '無法完成 Face ID 設定';
      if (!/NotAllowedError|canceled|cancelled|取消/i.test(text)) setError(text);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button type="button" onClick={register} disabled={pending}>
        <ScanFace className="mr-2 h-4 w-4" />
        {pending ? '等待 Face ID…' : '在這台裝置啟用 Face ID'}
      </Button>
      {message ? <p className="text-sm text-foreground">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

