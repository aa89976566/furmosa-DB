'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { JarSerialPanel } from '@/components/pos/jar-serial-panel';

type Props = {
  orderId: string;
  status: string;
  paid: boolean;
  deliveryMode: string;
  payQrUrl: string | null;
  customerName: string;
  oldSerial: string | null;
  newSerial: string | null;
  missingContainerNote: string | null;
};

export function RefillOrderActions({
  orderId,
  status,
  paid,
  deliveryMode,
  payQrUrl,
  customerName,
  oldSerial,
  newSerial,
  missingContainerNote,
}: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scannedOld, setScannedOld] = useState(oldSerial ?? '');
  const [scannedNew, setScannedNew] = useState(newSerial ?? '');
  const [missingOpen, setMissingOpen] = useState(Boolean(missingContainerNote));

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '操作失敗');
      setMsg('完成');
      router.refresh();
      return data;
    } catch (e) {
      setErr(e instanceof Error ? e.message : '操作失敗');
      return null;
    } finally {
      setBusy(false);
    }
  }

  if (!paid) {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="font-semibold text-amber-950">尚未付款</p>
          <p className="mt-1 text-sm text-amber-900">換罐款由匠寵線上收。店內不用收款。</p>
        </div>
        {payQrUrl ? (
          <a
            href={payQrUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[48px] items-center justify-center rounded-2xl border text-sm text-primary"
          >
            請客人用 LINE 自己付款
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">請客人從 LINE「我要換罐」完成付款。</p>
        )}
      </div>
    );
  }

  if (status === 'completed') {
    return <p className="text-sm text-muted-foreground">這筆換罐已完成。</p>;
  }

  if (status === 'awaiting_extra_payment') {
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <p className="font-semibold text-amber-950">尚未帶回空罐</p>
          <p className="mt-1 text-sm text-amber-900">
            請客人先完成補差額，或下次帶空罐再領。店內不用代收現金。
          </p>
        </div>
        {payQrUrl ? (
          <a
            href={payQrUrl}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[48px] items-center justify-center rounded-2xl border text-sm text-primary"
          >
            請客人線上補差額
          </a>
        ) : null}
      </div>
    );
  }

  const isFirst = deliveryMode === 'first';
  const waitingOld = !isFirst && status === 'paid_waiting_return';
  const readyForNew = status === 'old_container_verified' || isFirst;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-emerald-900">
        <p className="font-semibold">已付款</p>
        <p className="mt-1 text-sm">店內不用收款</p>
      </div>

      <dl className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
        <Row label="客人" value={customerName} />
        <Row label="舊罐" value={scannedOld ? `#${scannedOld}` : waitingOld ? '還沒掃' : '不用回收'} />
        <Row
          label="狀態"
          value={readyForNew ? '可以換罐' : waitingOld ? '等待回收空罐' : status}
        />
        <Row label="付款" value="已完成" />
      </dl>

      {waitingOld && !missingOpen ? (
        <>
          {!scannedOld ? (
            <JarSerialPanel
              title="掃客人帶來的空罐"
              primaryLabel="掃描罐底"
              secondaryLabel="手動輸入序號"
              onSerial={(value) => setScannedOld(value)}
              busy={busy}
            />
          ) : (
            <Button
              className="w-full min-h-[52px] text-base"
              disabled={busy}
              onClick={() =>
                post(`/api/merchant/refill-orders/${orderId}/verify-old-container`, {
                  serial: scannedOld,
                })
              }
            >
              確認回收
            </Button>
          )}
          <button
            type="button"
            className="min-h-[48px] w-full text-sm text-muted-foreground"
            onClick={() => setMissingOpen(true)}
          >
            客人忘記帶空罐
          </button>
        </>
      ) : null}

      {waitingOld && missingOpen ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-950">尚未帶回空罐</p>
          <p className="text-sm text-amber-900">
            請客人先完成補差額，或下次帶空罐再領。不能直接把新罐拿走。
          </p>
          <Button
            className="min-h-[48px] w-full"
            disabled={busy}
            onClick={() =>
              post(`/api/merchant/refill-orders/${orderId}/mark-missing-container`, {
                choice: 'topup',
              })
            }
          >
            請客人線上補差額
          </Button>
          <Button
            variant="outline"
            className="min-h-[48px] w-full"
            disabled={busy}
            onClick={() =>
              post(`/api/merchant/refill-orders/${orderId}/mark-missing-container`, {
                choice: 'keep',
              })
            }
          >
            下次帶空罐再領
          </Button>
        </div>
      ) : null}

      {readyForNew ? (
        <>
          {!scannedNew ? (
            <JarSerialPanel
              title="掃要交給客人的新罐"
              primaryLabel="掃描新罐"
              secondaryLabel="手動輸入新罐序號"
              onSerial={(value) => setScannedNew(value)}
              busy={busy}
            />
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-card px-4 py-3 text-sm">
                <p className="text-muted-foreground">新罐</p>
                <p className="text-lg font-semibold text-navy">#{scannedNew}</p>
              </div>
              <Button
                className="w-full min-h-[52px] text-base"
                disabled={busy}
                onClick={() =>
                  post(`/api/merchant/refill-orders/${orderId}/complete`, {
                    newSerial: scannedNew,
                    oldSerial: scannedOld || undefined,
                  })
                }
              >
                完成換罐
              </Button>
            </div>
          )}
        </>
      ) : null}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
