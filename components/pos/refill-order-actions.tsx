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
      setMessage(`完成：已交給客人 ${pickupQuantity} 罐。請提醒客人到官方 LINE 登記新罐。`);
      router.refresh();
    }
  }

  if (!paid) {
    return <p className="rounded-xl border border-[#e7e5e4] bg-white p-4 text-sm">客人還沒付款。請客人先到官方 LINE 付款，付款成功後才能交付商品。</p>;
  }
  if (status === 'completed' || remainingQuantity === 0) {
    return <p className="rounded-xl border border-[#e7e5e4] bg-white p-4 text-sm">這筆訂單已全部交付，不需要再操作。</p>;
  }
  if (status === 'awaiting_extra_payment') {
    return (
      <div className="space-y-3 rounded-xl border border-[#e7e5e4] bg-white p-4">
        <p className="font-medium">客人還需要補款</p>
        <p className="text-sm text-muted-foreground">請客人到官方 LINE 付款。付款成功後，再回來交付商品。</p>
        {payQrUrl ? <Button asChild className="w-full"><a href={payQrUrl}>開啟 LINE 付款頁</a></Button> : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-[#e7e5e4] bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div><p className="font-medium">1. 這次給客人幾罐？</p><p className="text-sm text-muted-foreground">最多可以給 {remainingQuantity} 罐</p></div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" disabled={pickupQuantity <= 1} onClick={() => { setPickupQuantity((n) => n - 1); setQuote(null); }}>−</Button>
            <strong>{pickupQuantity}</strong>
            <Button variant="outline" size="icon" disabled={pickupQuantity >= remainingQuantity} onClick={() => { setPickupQuantity((n) => n + 1); setQuote(null); }}>＋</Button>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <div><p className="font-medium">2. 這次收到幾個空罐？</p><p className="text-sm text-muted-foreground">這位客人最多可歸還 {availableReturnQuantity} 個</p></div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" disabled={returnQuantity <= 0} onClick={() => changeReturnQuantity(returnQuantity - 1)}>−</Button>
            <strong>{returnQuantity}</strong>
            <Button variant="outline" size="icon" disabled={returnQuantity >= availableReturnQuantity} onClick={() => changeReturnQuantity(returnQuantity + 1)}>＋</Button>
          </div>
        </div>
      </section>

      {serials.map((serial, index) => (
        <div key={index} className="space-y-2">
          <label className="text-sm font-medium">第 {index + 1} 個空罐的瓶底號碼</label>
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
            placeholder="輸入瓶底 8 位數字"
          />
        </div>
      ))}

      {!quote ? (
        <Button className="min-h-[52px] w-full bg-[#191919] hover:bg-black" disabled={busy || !serialsReady} onClick={review}>下一步：確認交付內容</Button>
      ) : (
        <section className="space-y-4 rounded-xl border border-[#e7e5e4] bg-white p-4">
          <h2 className="font-semibold">請確認這次的內容</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-muted-foreground">換罐價商品</dt><dd className="font-medium">{quote.exchangeQuantity} 罐</dd></div>
            <div><dt className="text-muted-foreground">原價商品</dt><dd className="font-medium">{quote.originalPriceQuantity} 罐</dd></div>
            <div><dt className="text-muted-foreground">多收的空罐</dt><dd className="font-medium">{quote.extraReturnQuantity} 個</dd></div>
            <div><dt className="text-muted-foreground">客人要補款</dt><dd className="font-medium">NT${quote.topUpAmount}</dd></div>
          </dl>
          {quote.topUpAmount > 0 ? (
            <Button className="min-h-[52px] w-full bg-[#191919] hover:bg-black" disabled={busy} onClick={requestTopUp}>通知客人到 LINE 補款 NT${quote.topUpAmount}</Button>
          ) : (
            <Button className="min-h-[52px] w-full bg-[#191919] hover:bg-black" disabled={busy} onClick={fulfill}>確認交付並扣除庫存</Button>
          )}
        </section>
      )}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
