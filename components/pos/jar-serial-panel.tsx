'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
  'flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-60';
const secondaryClass =
  'flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-900 bg-white text-base font-semibold text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-60';
const ghostClass =
  'flex min-h-11 w-full items-center justify-center text-base text-zinc-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2';

export function JarSerialPanel({
  title,
  primaryLabel,
  secondaryLabel,
  primaryHint,
  secondaryHint,
  submitLabel = '查找客人',
  busyLabel = '查找中…',
  onSerial,
  busy = false,
  allowAnyQuery = false,
  variant = 'stack',
  inputId,
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
  inputId?: string;
}) {
  const generatedId = useId();
  const fieldId = inputId ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const [mode, setMode] = useState<'idle' | 'scan' | 'manual'>('idle');
  const [serial, setSerial] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const onSerialRef = useRef(onSerial);
  onSerialRef.current = onSerial;

  useEffect(() => {
    if (mode !== 'scan') return;
    let cancelled = false;
    const Detector = getBarcodeDetector();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setHint('這台裝置無法開啟相機，請改用手動輸入序號。');
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
        setHint('無法開啟相機，請改用手動輸入序號。');
        setMode('manual');
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode]);

  useEffect(() => {
    if (mode !== 'manual') return;
    inputRef.current?.focus();
  }, [mode]);

  const trimmed = serial.trim();
  const manualBlockedReason = allowAnyQuery
    ? trimmed
      ? null
      : '請輸入罐底序號或訂單編號。'
    : trimmed.length === 8
      ? null
      : '請輸入罐底 8 位數字。';

  function submitManual() {
    if (allowAnyQuery) {
      if (!trimmed) {
        setHint('請輸入罐底序號或訂單編號。');
        return;
      }
      setHint(null);
      setMode('idle');
      onSerial(trimmed);
      return;
    }
    const code = normalizeJarCode(trimmed);
    if (!isValidJarCodeFormat(code)) {
      setHint('請輸入罐底 8 位數字，例如 38124491。');
      return;
    }
    setHint(null);
    setMode('idle');
    onSerial(code);
  }

  const actions =
    variant === 'cards' ? (
      <div className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          disabled={busy}
          className="flex min-h-[96px] flex-col items-start justify-center rounded-2xl bg-zinc-900 px-5 py-4 text-left text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-60"
          onClick={() => {
            setHint(null);
            setMode('scan');
          }}
        >
          <ScanLine className="mb-3 h-6 w-6" aria-hidden />
          <span className="text-lg font-semibold">{busy ? busyLabel : primaryLabel}</span>
          <span className="mt-1 text-base text-white/80">{primaryHint ?? '掃描空罐底部 QR Code'}</span>
        </button>
        <button
          type="button"
          disabled={busy}
          className="flex min-h-[96px] flex-col items-start justify-center rounded-2xl border border-zinc-900 bg-white px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-60"
          onClick={() => {
            setHint(null);
            setMode('manual');
          }}
        >
          <PencilLine className="mb-3 h-6 w-6" aria-hidden />
          <span className="text-lg font-semibold">{secondaryLabel}</span>
          <span className="mt-1 text-base text-zinc-500">{secondaryHint ?? '輸入罐底 8 位數字'}</span>
        </button>
      </div>
    ) : variant === 'tile' ? (
      <div className="space-y-2">
        <button
          type="button"
          disabled={busy}
          className="flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-7 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 disabled:opacity-60"
          onClick={() => {
            setHint(null);
            setMode('scan');
          }}
        >
          <ScanLine className="mb-2 h-6 w-6 text-zinc-500" aria-hidden />
          <span className="text-base font-semibold text-zinc-900">{busy ? busyLabel : primaryLabel}</span>
          <span className="mt-1 text-sm text-zinc-500">{primaryHint ?? '掃描罐底 QR Code'}</span>
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
      {title ? <p className="text-base font-medium text-zinc-900">{title}</p> : null}
      {mode === 'idle' ? actions : null}

      {mode === 'scan' ? (
        <div className="space-y-3">
          <p className="text-base font-medium text-zinc-900">掃描罐底</p>
          <video
            ref={videoRef}
            className="h-48 w-full rounded-2xl bg-zinc-900 object-cover"
            playsInline
            muted
            aria-label="掃描罐底"
          />
          <button type="button" className={ghostClass} onClick={() => setMode('manual')}>
            改用手動輸入序號
          </button>
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="space-y-3">
          <div>
            <label htmlFor={fieldId} className="block text-base font-medium text-zinc-900">
              {allowAnyQuery ? '罐底序號或訂單編號' : '罐底序號'}
            </label>
            <input
              ref={inputRef}
              id={fieldId}
              inputMode={allowAnyQuery ? 'text' : 'numeric'}
              autoComplete="off"
              maxLength={allowAnyQuery ? 40 : 8}
              value={serial}
              aria-invalid={hint ? true : undefined}
              aria-describedby={hint || manualBlockedReason ? hintId : undefined}
              onChange={(e) =>
                setSerial(
                  allowAnyQuery
                    ? e.target.value
                    : e.target.value.replace(/\D/g, '').slice(0, 8),
                )
              }
              placeholder={allowAnyQuery ? '例如 38124491 或 #RFP-240428-0012' : '例如 38124491'}
              className="mt-2 h-12 w-full break-all rounded-xl border border-neutral-200 bg-white px-3 text-center text-lg tracking-[0.18em] outline-none focus:border-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-900"
            />
          </div>
          <button
            type="button"
            className={primaryClass}
            disabled={busy || Boolean(manualBlockedReason)}
            onClick={submitManual}
          >
            {busy ? busyLabel : submitLabel}
          </button>
          {manualBlockedReason && !hint ? (
            <p id={hintId} className="text-sm text-zinc-600">
              {manualBlockedReason}
            </p>
          ) : null}
          <button type="button" className={ghostClass} onClick={() => setMode('idle')}>
            返回選擇掃描或輸入
          </button>
        </div>
      ) : null}

      {hint ? (
        <p id={hintId} role="alert" className="whitespace-pre-line text-base text-zinc-800">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
