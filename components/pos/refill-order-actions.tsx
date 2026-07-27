'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { POS_BUTTON_LABELS } from '@/lib/config/product-settings';

type Props = {
  orderId: string;
  status: string;
  paid: boolean;
  deliveryMode: string;
  payQrUrl: string | null;
};

export function RefillOrderActions({
  orderId,
  status,
  paid,
  deliveryMode,
  payQrUrl,
}: Props) {
  const router = useRouter();
  const [oldSerial, setOldSerial] = useState('');
  const [newSerial, setNewSerial] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <p className="text-sm font-medium text-amber-800">尚未付款 — 不可交付，也不可代收現金。</p>
        {payQrUrl ? (
          <div className="rounded-xl border p-4 space-y-2">
            <p className="text-sm">請客人用 LINE 掃碼自行付款給匠寵：</p>
            <a
              href={payQrUrl}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-sm text-primary underline"
            >
              {payQrUrl}
            </a>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">請客人從 LINE「我要換罐」付款。</p>
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
        <p className="text-sm">等待客人線上補付 NT$30。店家不收現金。</p>
        {payQrUrl ? (
          <a href={payQrUrl} className="text-sm text-primary underline" target="_blank" rel="noreferrer">
            打開補付連結
          </a>
        ) : null}
      </div>
    );
  }

  const isFirst = deliveryMode === 'first';

  return (
    <div className="space-y-4">
      {!isFirst && status === 'paid_waiting_return' ? (
        <div className="space-y-2">
          <label className="text-sm font-medium">舊罐瓶底 8 碼</label>
          <Input
            inputMode="numeric"
            maxLength={8}
            value={oldSerial}
            onChange={(e) => setOldSerial(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="輸入空罐序號"
            className="min-h-[48px] text-lg tracking-widest"
          />
        </div>
      ) : null}

      {(status === 'old_container_verified' || isFirst) && (
        <div className="space-y-2">
          <label className="text-sm font-medium">新罐瓶底 8 碼</label>
          <Input
            inputMode="numeric"
            maxLength={8}
            value={newSerial}
            onChange={(e) => setNewSerial(e.target.value.replace(/\D/g, '').slice(0, 8))}
            placeholder="輸入新罐序號"
            className="min-h-[48px] text-lg tracking-widest"
          />
        </div>
      )}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}

      {!isFirst && status === 'paid_waiting_return' ? (
        <>
          <Button
            className="w-full min-h-[52px]"
            disabled={busy || oldSerial.length !== 8}
            onClick={() =>
              post(`/api/merchant/refill-orders/${orderId}/verify-old-container`, {
                serial: oldSerial,
              })
            }
          >
            確認收到空罐
          </Button>
          <Button
            variant="outline"
            className="w-full min-h-[48px]"
            disabled={busy}
            onClick={async () => {
              const choice = window.confirm(
                '客人沒帶空罐？\n按「確定」= 線上補付 NT$30\n按「取消」後可再選保留下次',
              );
              if (choice) {
                await post(`/api/merchant/refill-orders/${orderId}/mark-missing-container`, {
                  choice: 'topup',
                });
              } else if (window.confirm('改為保留下次領取？（不交付、不加點）')) {
                await post(`/api/merchant/refill-orders/${orderId}/mark-missing-container`, {
                  choice: 'keep',
                });
              }
            }}
          >
            顧客沒帶空罐
          </Button>
        </>
      ) : null}

      {status === 'old_container_verified' || isFirst ? (
        <Button
          className="w-full min-h-[52px]"
          disabled={busy || newSerial.length !== 8}
          onClick={() =>
            post(`/api/merchant/refill-orders/${orderId}/complete`, {
              newSerial,
              oldSerial: oldSerial || undefined,
            })
          }
        >
          {isFirst
            ? POS_BUTTON_LABELS.confirmDeliverProduct
            : POS_BUTTON_LABELS.confirmEmptyJarAndDeliver}
        </Button>
      ) : null}

      {/* One-shot: verify old + assign new */}
      {!isFirst && status === 'paid_waiting_return' ? (
        <Button
          variant="secondary"
          className="w-full min-h-[48px]"
          disabled={busy || oldSerial.length !== 8 || newSerial.length !== 8}
          onClick={() =>
            post(`/api/merchant/refill-orders/${orderId}/complete`, {
              newSerial,
              oldSerial,
            })
          }
        >
          一次完成：收空罐並交付
        </Button>
      ) : null}
    </div>
  );
}
