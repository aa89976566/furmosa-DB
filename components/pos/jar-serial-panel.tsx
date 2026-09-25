'use client';

import { useState } from 'react';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';

export function JarSerialPanel({
  title,
  submitLabel = '查詢訂單',
  busyLabel = '查詢中...',
  onSerial,
  busy = false,
  allowAnyQuery = false,
}: {
  title?: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryHint?: string;
  secondaryHint?: string;
  submitLabel?: string;
  busyLabel?: string;
  onSerial: (serial: string) => void;
  busy?: boolean;
  allowAnyQuery?: boolean;
  variant?: 'stack' | 'cards' | 'tile';
}) {
  const [serial, setSerial] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  function submitManual() {
    const value = serial.trim();
    if (allowAnyQuery) {
      if (!value) {
        setHint('請輸入罐底序號或訂單編號');
        return;
      }
      setHint(null);
      onSerial(value);
      return;
    }
    const code = normalizeJarCode(value);
    if (!isValidJarCodeFormat(code)) {
      setHint('請輸入罐底 8 位數字');
      return;
    }
    setHint(null);
    onSerial(code);
  }

  return (
    <div className="space-y-3">
      {title ? <p className="text-sm font-semibold text-foreground">{title}</p> : null}
      <label className="sr-only" htmlFor="jar-serial-input">罐底序號或訂單編號</label>
      <input
        id="jar-serial-input"
        inputMode={allowAnyQuery ? 'text' : 'numeric'}
        maxLength={allowAnyQuery ? 40 : 8}
        value={serial}
        onChange={(event) =>
          setSerial(
            allowAnyQuery
              ? event.target.value
              : event.target.value.replace(/\D/g, '').slice(0, 8),
          )
        }
        onKeyDown={(event) => {
          if (event.key === 'Enter') submitManual();
        }}
        placeholder={allowAnyQuery ? '罐底序號或訂單編號' : '罐底 8 碼'}
        className="h-14 w-full rounded-2xl border-2 border-border bg-card px-4 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <button
        type="button"
        disabled={busy || (!allowAnyQuery && serial.length !== 8)}
        onClick={submitManual}
        className="flex min-h-12 w-full items-center justify-center rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? busyLabel : submitLabel}
      </button>
      {hint ? <p className="text-sm text-destructive">{hint}</p> : null}
    </div>
  );
}
