'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { isValidJarCodeFormat, normalizeJarCode } from '@/lib/jar-exchange/codes';

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

function getBarcodeDetector(): (new (opts: { formats: string[] }) => BarcodeDetectorLike) | null {
  const ctor = (globalThis as { BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike })
    .BarcodeDetector;
  return ctor ?? null;
}

export function JarSerialPanel({
  title,
  primaryLabel,
  secondaryLabel,
  onSerial,
  busy = false,
}: {
  title: string;
  primaryLabel: string;
  secondaryLabel: string;
  onSerial: (serial: string) => void;
  busy?: boolean;
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
      setHint('這台手機還沒辦法直接掃罐底，請改用手打 8 碼。');
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
        setHint('相機打不開，請改用手打 8 碼。');
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
    const value = normalizeJarCode(serial);
    if (!isValidJarCodeFormat(value)) {
      setHint('請輸入罐底 8 位數字。');
      return;
    }
    onSerial(value);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-navy">{title}</p>
      {mode === 'idle' ? (
        <div className="grid gap-2">
          <Button
            type="button"
            className="min-h-[52px] w-full text-base"
            disabled={busy}
            onClick={() => {
              setHint(null);
              setMode('scan');
            }}
          >
            {primaryLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[48px] w-full text-base"
            disabled={busy}
            onClick={() => {
              setHint(null);
              setMode('manual');
            }}
          >
            {secondaryLabel}
          </Button>
        </div>
      ) : null}

      {mode === 'scan' ? (
        <div className="space-y-3">
          <video ref={videoRef} className="h-48 w-full rounded-2xl bg-navy/80 object-cover" playsInline muted />
          <Button type="button" variant="ghost" className="min-h-[48px] w-full" onClick={() => setMode('manual')}>
            改用手打
          </Button>
        </div>
      ) : null}

      {mode === 'manual' ? (
        <div className="space-y-3">
          <Input
            inputMode="numeric"
            maxLength={8}
            value={serial}
            onChange={(e) => setSerial(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="罐底 8 碼"
            className="min-h-[52px] text-center text-xl tracking-[0.3em]"
          />
          <Button
            type="button"
            className="min-h-[52px] w-full text-base"
            disabled={busy || serial.length !== 8}
            onClick={submitManual}
          >
            確認序號
          </Button>
          <Button type="button" variant="ghost" className="min-h-[48px] w-full" onClick={() => setMode('idle')}>
            返回
          </Button>
        </div>
      ) : null}

      {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
