'use client';

import { useEffect, useRef, useState } from 'react';
import { PencilLine, ScanLine } from 'lucide-react';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector(): (new (opts: { formats: string[] }) => BarcodeDetectorLike) | null {
  const ctor = (globalThis as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  return ctor ?? null;
}

const primaryClass =
  'flex min-h-[48px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white disabled:opacity-60';
const secondaryClass =
  'flex min-h-[48px] w-full items-center justify-center rounded-xl border border-zinc-900 bg-white text-sm font-semibold text-zinc-900 disabled:opacity-60';
const ghostClass = 'flex min-h-[44px] w-full items-center justify-center text-sm text-zinc-500';

export function JarSerialPanel({
  title,
  primaryLabel,
  secondaryLabel,
  primaryHint,
  secondaryHint,
  submitLabel = '查詢',
  busyLabel = '查詢中...',
  onSerial,
  busy = false,
  allowAnyQuery = false,
  variant = 'stack',
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
  const [mode, setMode] = useState<'idle' | 'scan' | 'manual'>('idle');
  const [serial, setSerial] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const onSerialRef = useRef(onSerial);
  onSerialRef.current = onSerial;

  useEffect(() => {
    if (mode !== 'scan') return;
    let cancelled = false;
    const Detector = getBarcodeDetector();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setHint('無法開啟相機\n請改用手動輸入序號');
      setMode('manual');
      return;
    }

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ['code_128', 'code_39', 'ean_13', 'qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const found = codes
              .map((c) => normalizeJarCode(c.rawValue))
              .find((value) => isValidJarCodeFormat(value));
            if (found) {
              cancelled = true;
              streamRef.current?.getTracks().forEach((t) => t.stop());
              streamRef.current = null;
              setMode('idle');
              onSerialRef.current(found);
              return;
            }
          } catch {
            /* keep scanning */
          }
          requestAnimationFrame(() => {
            void tick();
          });
        };
        void tick();
      } catch {
        setHint('無法開啟相機\n請改用手動輸入序號');
        setMode('manual');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode]);

  function submitManual() {
    const value = serial.trim();
    if (allowAnyQuery) {
      if (!value) {
        setHint('請輸入罐底序號或訂單編號');
        return;
      }
      setMode('idle');
      onSerial(value);
      return;
    }
    const code = normalizeJarCode(value);
    if (!isValidJarCodeFormat(code)) {
      setHint('請輸入罐底 8 位數字');
      return;
    }
    setMode('idle');
    onSerial(code);
  }

  const actions =
    variant === 'cards' ? (
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          className="flex min-h-[120px] flex-col items-start justify-center rounded-2xl bg-zinc-900 px-5 py-4 text-left text-white disabled:opacity-60"
          onClick={() => {
            setHint(null);
            setMode('scan');
          }}
        >
          <ScanLine className="mb-3 h-6 w-6" />
          <span className="text-base font-semibold">{busy ? busyLabel : primaryLabel}</span>
          <span className="mt-1 text-sm text-white/70">{primaryHint ?? '掃描空罐底部 QR Code'}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          className="flex min-h-[120px] flex-col items-start justify-center rounded-2xl border border-zinc-900 bg-white px-5 py-4 text-left disabled:opacity-60"
          onClick={() => {
            setHint(null);
            setMode('manual');
          }}
        >
          <PencilLine className="mb-3 h-6 w-6" />
          <span className="text-base font-semibold">{secondaryLabel}</span>
          <span className="mt-1 text-sm text-zinc-500">{secondaryHint ?? '輸入罐底序號查詢訂單'}</span>
        </button>
      </div>
    ) : variant === 'tile' ? (
      <div className="space-y-2">
        <button
          type="button"
          disabled={busy}
          className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-7 text-center disabled:opacity-60"
          onClick={() => {
            setHint(null);
            setMode('scan');
          }}
        >
          <ScanLine className="mb-2 h-6 w-6 text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-900">{busy ? busyLabel : primaryLabel}</span>
          <span className="mt-1 text-xs text-zinc-500">{primaryHint ?? '掃描要給客人的新罐'}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          className={ghostClass}
          onClick={() => {
            setHint(null);
            setMode('manual');
          }}
        >
          {secondaryLabel}
        </button>
      </div>
    ) : (
      <div className="grid gap-2">
        <button
          type="button"
          className={primaryClass}
          disabled={busy}
          onClick={() => {
            setHint(null);
            setMode('scan');
          }}
        >
          {busy ? busyLabel : primaryLabel}
        </button>
        <button
          type="button"
          className={secondaryClass}
          disabled={busy}
          onClick={() => {
            setHint(null);
            setMode('manual');
          }}
        >
          {secondaryLabel}
        </button>
      </div>
    );

  return (
    <div className="space-y-3">
      {title ? <p className="text-sm font-medium text-zinc-900">{title}</p> : null}
      {mode === 'idle' ? actions : null}

      {mode === 'scan' ? (
        <div className="space-y-3">
          <video ref={videoRef} className="h-48 w-full rounded-2xl bg-zinc-900 object-cover" playsInline muted />
          <button type="button" className={ghostClass} onClick={() => setMode('manual')}>
            改用手動輸入序號
          </button>
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="space-y-3">
          <label className="text-sm text-zinc-500">罐底序號</label>
          <input
            inputMode={allowAnyQuery ? 'text' : 'numeric'}
            maxLength={allowAnyQuery ? 40 : 8}
            value={serial}
            onChange={(e) =>
              setSerial(
                allowAnyQuery
                  ? e.target.value
                  : e.target.value.replace(/\D/g, '').slice(0, 8),
              )
            }
            placeholder={allowAnyQuery ? '罐底序號或訂單編號' : '罐底 8 碼'}
            className="h-12 w-full rounded-xl border border-neutral-200 bg-white text-center text-lg tracking-[0.2em] outline-none focus:border-zinc-900"
          />
          <button
            type="button"
            className={primaryClass}
            disabled={busy || (!allowAnyQuery && serial.length !== 8)}
            onClick={submitManual}
          >
            {busy ? busyLabel : submitLabel}
          </button>
          <button type="button" className={ghostClass} onClick={() => setMode('idle')}>
            返回
          </button>
        </div>
      ) : null}

      {hint ? <p className="whitespace-pre-line text-sm text-red-600">{hint}</p> : null}
    </div>
  );
}
