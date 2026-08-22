'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Quote = {
  exchangeQuantity: number;
  originalPriceQuantity: number;
  extraReturnQuantity: number;
  topUpAmount: number;
};

type Props = {
  orderId: string;
  status: string;
  paid: boolean;
  payQrUrl: string | null;
  remainingQuantity: number;
  availableReturnQuantity: number;
};

export function RefillOrderActions({
  orderId,
  status,
  paid,
  payQrUrl,
  remainingQuantity,
  availableReturnQuantity,
}: Props) {
  const router = useRouter();
  const [pickupQuantity, setPickupQuantity] = useState(Math.min(1, remainingQuantity));
  const [returnQuantity, setReturnQuantity] = useState(0);
  const [serials, setSerials] = useState<string[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const serialsReady = useMemo(
    () => serials.length === returnQuantity && serials.every((serial) => /^\d{8}$/.test(serial)),
    [returnQuantity, serials],
  );

  function changeReturnQuantity(next: number) {
    setReturnQuantity(next);
    setSerials((current) => Array.from({ length: next }, (_, index) => current[index] ?? ''));
    setQuote(null);
  }

  async function post(path: string, body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? '操作失敗');
      return data;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '操作失敗');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function review() {
    const data = await post(`/api/merchant/refill-orders/${orderId}/fulfillment-quote`, {
      pickupQuantity,
      returnedQuantity: returnQuantity,
    });
    if (data?.quote) setQuote(data.quote as Quote);
  }

  async function requestTopUp() {
    const data = await post(`/api/merchant/refill-orders/${orderId}/request-top-up`, {
      pickupQuantity,
      returnedSerials: serials,
      idempotencyKey: crypto.randomUUID(),
    });
    if (data) {
      setMessage(`已建立 NT$${data.quote.topUpAmount} 官方 LINE 補款單；付款成功後才能交付。`);
      router.refresh();
    }
  }

  async function fulfill() {
    const data = await post(`/api/merchant/refill-orders/${orderId}/fulfill`, {
      pickupQuantity,
      returnedSerials: serials,
      idempotencyKey: crypto.randomUUID(),
    });
    if (data) {
      setMessage(`已完成交付 ${pickupQuantity} 罐；新罐等待顧客透過官方 LINE 登記。`);
      router.refresh();
    }
  }

  if (!paid) {
    return <p className="rounded-xl border p-4 text-sm">尚未付款，不可交付。請顧客先從官方 LINE 完成付款。</p>;
  }
  if (status === 'completed' || remainingQuantity === 0) {
    return <p className="rounded-xl border p-4 text-sm">這筆訂單已全部交付。</p>;
  }
  if (status === 'awaiting_extra_payment') {
    return (
      <div className="space-y-3 rounded-xl border p-4">
        <p className="font-medium">等待顧客透過官方 LINE 完成補款</p>
        <p className="text-sm text-muted-foreground">付款完成前，系統不會扣庫存或完成交付。</p>
        {payQrUrl ? <Button asChild className="w-full"><a href={payQrUrl}>開啟官方 LINE 付款</a></Button> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border p-4">
        <div className="flex items-center justify-between gap-4">
          <div><p className="font-medium">本次領取</p><p className="text-sm text-muted-foreground">尚可領取 {remainingQuantity} 罐</p></div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" disabled={pickupQuantity <= 1} onClick={() => { setPickupQuantity((n) => n - 1); setQuote(null); }}>−</Button>
            <strong>{pickupQuantity}</strong>
            <Button variant="outline" size="icon" disabled={pickupQuantity >= remainingQuantity} onClick={() => { setPickupQuantity((n) => n + 1); setQuote(null); }}>＋</Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div><p className="font-medium">本次歸還空罐</p><p className="text-sm text-muted-foreground">會員最多有 {availableReturnQuantity} 個可歸還</p></div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" disabled={returnQuantity <= 0} onClick={() => changeReturnQuantity(returnQuantity - 1)}>−</Button>
            <strong>{returnQuantity}</strong>
            <Button variant="outline" size="icon" disabled={returnQuantity >= availableReturnQuantity} onClick={() => changeReturnQuantity(returnQuantity + 1)}>＋</Button>
          </div>
        </div>
      </section>

      {serials.map((serial, index) => (
        <div key={index} className="space-y-2">
          <label className="text-sm font-medium">空罐 {index + 1} 的瓶底 8 碼</label>
          <Input
            inputMode="numeric"
            maxLength={8}
            value={serial}
            onChange={(event) => {
              const next = [...serials];
              next[index] = event.target.value.replace(/\D/g, '').slice(0, 8);
              setSerials(next);
              setQuote(null);
            }}
            placeholder="輸入 8 位數字"
          />
        </div>
      ))}

      {!quote ? (
        <Button className="w-full min-h-[52px]" disabled={busy || !serialsReady} onClick={review}>查看本次交付結果</Button>
      ) : (
        <section className="space-y-4 rounded-xl border p-4">
          <h2 className="font-semibold">交付確認</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">換罐價</dt><dd className="font-medium">{quote.exchangeQuantity} 罐</dd></div>
            <div><dt className="text-muted-foreground">原價</dt><dd className="font-medium">{quote.originalPriceQuantity} 罐</dd></div>
            <div><dt className="text-muted-foreground">額外回收</dt><dd className="font-medium">{quote.extraReturnQuantity} 個</dd></div>
            <div><dt className="text-muted-foreground">還需補款</dt><dd className="font-medium">NT${quote.topUpAmount}</dd></div>
          </dl>
          {quote.topUpAmount > 0 ? (
            <Button className="w-full min-h-[52px]" disabled={busy} onClick={requestTopUp}>建立官方 LINE 補款 NT${quote.topUpAmount}</Button>
          ) : (
            <Button className="w-full min-h-[52px]" disabled={busy} onClick={fulfill}>確認交付 {pickupQuantity} 罐</Button>
          )}
        </section>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
