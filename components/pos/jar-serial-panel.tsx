'use client';

import { useEffect, useRef, useState } from 'react';
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
  submitLabel = '查詢',
  busyLabel = '查詢中...',
  onSerial,
  busy = false,
  allowAnyQuery = false,
}: {
  title?: string;
  primaryLabel: string;
  secondaryLabel: string;
  submitLabel?: string;
  busyLabel?: string;
  onSerial: (serial: string) => void;
  busy?: boolean;
  /** 手動輸入可接受訂單編號，不只 8 碼罐序 */
  allowAnyQuery?: boolean;
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

  return (
    <div className="space-y-3">
      {title ? <p className="text-sm font-medium text-zinc-900">{title}</p> : null}
      {mode === 'idle' ? (
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
      ) : null}

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

      {hint ? (
        <p className="whitespace-pre-line text-sm text-red-600">{hint}</p>
      ) : null}
    </div>
  );
}
