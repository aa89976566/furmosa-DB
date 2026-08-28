'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { JarSerialPanel } from '@/components/pos/jar-serial-panel';

export function RefillScanEntry() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function lookup(serial: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/merchant/refill-orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serial }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '找不到這筆換罐');
      router.push(`/pos/refill/${data.orderId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : '找不到這筆換罐');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <JarSerialPanel
        title="客人拿空罐來了"
        primaryLabel="掃描罐底"
        secondaryLabel="手動輸入序號"
        onSerial={lookup}
        busy={busy}
      />
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </div>
  );
}
