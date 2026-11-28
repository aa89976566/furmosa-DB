'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LiffShell } from '@/components/liff/liff-shell';
import { LiffStatus } from '@/components/liff/liff-status';
import { Button } from '@/components/ui/button';
import { REFILL_COPY } from '@/lib/refill/copy';
import { FURMOSA_OFFICIAL_LINE_CHAT_URL } from '@/lib/line/official-line';

type Props = {
  liffId: string;
  storeId: string | null;
  orderId: string | null;
  paidHint: boolean;
  standalonePreorder: boolean;
};

type PreorderCatalog = {
  merchant: { id: string; name: string };
  flavours: { id: string; name: string; weightGrams: number }[];
};

type Booking = {
  appointmentId: string;
  petName: string | null;
  merchantName: string;
  date: string;
  time: string;
  activeOrderId: string | null;
  activeOrderStatus: string | null;
};

type Eligibility = {
  registered: boolean;
  customerName: string;
  petName: string | null;
  hasIssuedJar: boolean;
  orderType: 'first' | 'exchange';
  amount: number;
  message: string | null;
  bookings: Booking[];
  selectedBooking: Booking | null;
  openOrders: { id: string; status: string; totalAmount: number }[];
};

type OrderView = {
  id: string;
  status: string;
  orderType: string;
  totalAmount: number;
  baseAmount: number;
  extraAmount: number;
  petName: string | null;
  merchantName: string;
  date: string;
  time: string;
};

type Step =
  | 'load'
  | 'register'
  | 'pick'
  | 'no_booking'
  | 'pick_flavour'
  | 'confirm_preorder'
  | 'confirm'
  | 'paying'
  | 'success'
  | 'confirming'
  | 'view'
  | 'error';

export function LiffRefillClient(props: Props) {
  return (
    <LiffShell
      liffId={props.liffId}
      title="線上預購換罐"
      reconnectPath={`/liff/refill${props.storeId ? `?storeId=${props.storeId}` : ''}`}
    >
      {({ idToken }) => <RefillFlow idToken={idToken} {...props} />}
    </LiffShell>
  );
}

function RefillFlow({
  idToken,
  storeId,
  orderId,
  paidHint,
  standalonePreorder,
}: Props & { idToken: string }) {
  const [step, setStep] = useState<Step>(paidHint || orderId ? 'confirming' : 'load');
  const [error, setError] = useState<string | null>(null);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [busy, setBusy] = useState(false);
  const [eligibilityCheck, setEligibilityCheck] = useState(0);
  const [catalog, setCatalog] = useState<PreorderCatalog | null>(null);
  const [selectedFlavourId, setSelectedFlavourId] = useState<string | null>(null);
  const preorderAttempt = useRef<{ flavourId: string; key: string } | null>(null);
  const actionPending = useRef(false);

  const restartLineLogin = useCallback(async () => {
    const returnUrl = new URL('/liff/refill', window.location.origin);
    if (storeId) returnUrl.searchParams.set('storeId', storeId);

    try {
      const liff = (await import('@line/liff')).default;
      if (liff.isLoggedIn()) liff.logout();
    } finally {
      // Reload the canonical LIFF URL. LiffShell will initialize LIFF again and
      // start a fresh LINE Login without reusing an expired OAuth code.
      window.location.replace(returnUrl.toString());
    }
  }, [storeId]);

  const loadEligibility = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/refill/eligibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken, storeId, appointmentId: appointmentId ?? undefined }),
    });
    const data = await res.json();
    if (res.status === 404 && data.code === 'NOT_REGISTERED') {
      setStep('register');
      return null;
    }
    if (!res.ok) throw new Error(data.error ?? REFILL_COPY.genericError);
    setElig(data as Eligibility);
    return data as Eligibility;
  }, [idToken, storeId, appointmentId]);

  const loadOrder = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/refill/orders/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? REFILL_COPY.genericError);
      setOrder(data.order as OrderView);
      return data.order as OrderView;
    },
    [idToken],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (orderId) {
          setStep('confirming');
          let tries = 0;
          while (tries < 8 && !cancelled) {
            const o = await loadOrder(orderId);
            if (
              o.status === 'paid_waiting_return' ||
              o.status === 'old_container_verified' ||
              o.status === 'completed'
            ) {
              if (!cancelled) setStep('success');
              return;
            }
            tries += 1;
            await new Promise((r) => setTimeout(r, 1500));
          }
          if (!cancelled) {
            setStep('confirming');
            setError('付款還在確認中，晚一點再回來看就好');
          }
          return;
        }

        const e = await loadEligibility();
        if (cancelled || !e) return;
        if (e.openOrders?.[0]?.status === 'paid_waiting_return') {
          await loadOrder(e.openOrders[0].id);
          setStep('view');
          return;
        }
        if (standalonePreorder) {
          const res = await fetch('/api/refill/catalog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          const data = await res.json();
          if (cancelled) return;
          if (res.status === 401 && data.code === 'LINE_TOKEN_EXPIRED') {
            await restartLineLogin();
            return;
          }
          if (!res.ok) throw new Error(data.error ?? REFILL_COPY.genericError);
          setCatalog(data as PreorderCatalog);
          setStep('pick_flavour');
          return;
        }
        if (e.bookings.length === 0) {
          setStep('no_booking');
          return;
        }
        if (e.selectedBooking) {
          setAppointmentId(e.selectedBooking.appointmentId);
          setStep('confirm');
        } else {
          setStep('pick');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : REFILL_COPY.genericError);
          setStep('error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId, loadEligibility, loadOrder, eligibilityCheck, standalonePreorder, idToken, restartLineLogin]);

  async function preparePreorder() {
    if (!selectedFlavourId || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (preorderAttempt.current?.flavourId !== selectedFlavourId) {
        preorderAttempt.current = { flavourId: selectedFlavourId, key: window.crypto.randomUUID() };
      }
      const res = await fetch('/api/refill/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          flavourId: selectedFlavourId,
          idempotencyKey: preorderAttempt.current.key,
        }),
      });
      const data = await res.json();
      if (res.status === 401 && data.code === 'LINE_TOKEN_EXPIRED') {
        await restartLineLogin();
        return;
      }
      if (!res.ok) throw new Error(data.error ?? REFILL_COPY.genericError);
      setOrder(data.order as OrderView);
      setStep('confirm_preorder');
    } catch (err) {
      setError(err instanceof Error ? err.message : REFILL_COPY.genericError);
    } finally {
      setBusy(false);
      actionPending.current = false;
    }
  }

  async function onConfirmPay() {
    const preorderOrderId = step === 'confirm_preorder' ? order?.id : undefined;
    if ((!preorderOrderId && !appointmentId) || actionPending.current) return;
    actionPending.current = true;
    setBusy(true);
    setError(null);
    try {
      let oid = preorderOrderId;
      if (!oid) {
        const createRes = await fetch('/api/refill/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, appointmentId }),
        });
        const created = await createRes.json();
        if (createRes.status === 401 && created.code === 'LINE_TOKEN_EXPIRED') {
          await restartLineLogin();
          return;
        }
        if (!createRes.ok) throw new Error(created.error ?? REFILL_COPY.genericError);
        oid = created.order.id as string;
        setOrder(created.order);
      }

      const payRes = await fetch(`/api/refill/orders/${oid}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const pay = await payRes.json();
      if (payRes.status === 401 && pay.code === 'LINE_TOKEN_EXPIRED') {
        await restartLineLogin();
        return;
      }
      if (!payRes.ok) throw new Error(pay.error ?? REFILL_COPY.genericError);

      setStep('paying');
      // Auto-submit ECPay form
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = pay.checkout.paymentUrl;
      for (const [k, v] of Object.entries(pay.checkout.fields as Record<string, string>)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = v;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err instanceof Error ? err.message : REFILL_COPY.genericError);
      setStep(preorderOrderId ? 'confirm_preorder' : 'confirm');
    } finally {
      setBusy(false);
      actionPending.current = false;
    }
  }

  if (step === 'pick_flavour' && catalog) {
    return (
      <section className="space-y-4">
        <Row label="取罐店" value={catalog.merchant.name} />
        {catalog.flavours.length === 0 ? (
          <p>這間店目前沒有可預購的口味，請晚點再來查看。</p>
        ) : (
          <fieldset className="space-y-2 disabled:opacity-60" disabled={busy}>
            <legend className="mb-2 font-medium">選擇預購口味</legend>
            {catalog.flavours.map((flavour) => (
              <label key={flavour.id} className="flex min-h-12 items-center gap-3 rounded-xl border p-3">
                <input
                  type="radio"
                  name="refill-flavour"
                  checked={selectedFlavourId === flavour.id}
                  onChange={() => setSelectedFlavourId(flavour.id)}
                />
                  {flavour.name}{flavour.weightGrams > 0 ? ` · ${flavour.weightGrams}g` : ''}
              </label>
            ))}
          </fieldset>
        )}
        {error && <LiffStatus message={error} variant="error" />}
        <Button
          type="button"
          className="min-h-12 w-full"
          disabled={busy || !selectedFlavourId}
          onClick={preparePreorder}
        >
          {busy ? '處理中…' : '確認取罐店與金額'}
        </Button>
      </section>
    );
  }

  if (step === 'confirm_preorder' && order) {
    const isExchange = order.orderType === 'exchange';
    const flavour = catalog?.flavours.find((item) => item.id === selectedFlavourId);
    return (
      <section className="space-y-4">
        <dl className="space-y-2 text-sm">
          <Row label="取罐店" value={order.merchantName} />
          {flavour && <Row label="口味" value={flavour.name} />}
          <Row label="金額" value={`NT$${order.totalAmount}`} />
        </dl>
        <p>{isExchange ? '取罐時請帶合格空罐。未帶或驗收不符，可補 NT$30 取罐，本次不集點。' : '首罐到店直接領取，本次不集點。'}</p>
        {error && <LiffStatus message={error} variant="error" />}
        <Button type="button" className="min-h-12 w-full" disabled={busy} onClick={onConfirmPay}>
          {busy ? '處理中…' : REFILL_COPY.confirmPayAmount(order.totalAmount)}
        </Button>
      </section>
    );
  }

  if (step === 'register') {
    const returnTo = encodeURIComponent(
      `/liff/refill${storeId ? `?storeId=${storeId}` : ''}`,
    );
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">先完成會員註冊，就能繼續換罐</p>
        <Button asChild className="w-full min-h-[48px]">
          <a href={`/liff/register?return=${returnTo}`}>先去註冊</a>
        </Button>
      </div>
    );
  }

  if (step === 'load' || step === 'paying') {
    return <p className="text-sm text-muted-foreground">幫你準備中…</p>;
  }

  if (step === 'confirming') {
    return (
      <div className="space-y-3">
        <p className="text-lg font-semibold">{REFILL_COPY.confirmingPayment}</p>
        <p className="text-sm text-muted-foreground">銀行正在回傳結果，先別關掉這個畫面</p>
        {error && <LiffStatus message={error} variant="error" />}
      </div>
    );
  }

  if (step === 'no_booking') {
    return (
      <section className="space-y-4 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">換罐預購需要已確認的美容預約</h2>
        <p className="text-sm text-muted-foreground">
          目前沒有可用於線上預購的美容預約。想直接到店換罐，可以帶完整空罐回原合作店，出發前先確認供應。
        </p>
        <Button asChild className="min-h-12 w-full">
          <a href={FURMOSA_OFFICIAL_LINE_CHAT_URL}>回 LINE 查看合作店</a>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 w-full"
          onClick={() => {
            setStep('load');
            setEligibilityCheck((count) => count + 1);
          }}
        >
          店家已確認預約？重新查詢
        </Button>
      </section>
    );
  }

  if (step === 'error') {
    return <LiffStatus message={error ?? REFILL_COPY.genericError} variant="error" />;
  }

  if (step === 'success' || step === 'view') {
    const o = order;
    return (
      <div className="space-y-4">
        <div>
          <p className="text-lg font-semibold text-foreground">{REFILL_COPY.payDone}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {o?.orderType === 'first'
              ? '這次是第一罐，不用帶空罐｜到店後給店員確認，就能領取新罐'
              : '記得帶空罐到店裡｜店員確認空罐與交付品項後，就能領取新罐'}
          </p>
        </div>
        {o && (
          <dl className="space-y-2 text-sm">
            <Row label="毛孩" value={o.petName ?? '—'} />
            <Row label="店家" value={o.merchantName} />
            <Row label="日期" value={`${o.date} ${o.time}`} />
            <Row label="已付款" value={`NT$${o.totalAmount}`} />
            <Row label="訂單編號" value={o.id.slice(0, 8).toUpperCase()} />
            <Row label="狀態" value={REFILL_COPY.waitingAtStore} />
          </dl>
        )}
        {o?.orderType !== 'first' ? (
          <p className="text-sm font-medium text-foreground">{REFILL_COPY.rememberEmptyJar}</p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-[48px]"
          onClick={() => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const liff = (window as any).liff;
              if (liff?.closeWindow) liff.closeWindow();
            } catch {
              /* ignore */
            }
          }}
        >
          回到 LINE
        </Button>
      </div>
    );
  }

  if (step === 'pick' && elig) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{REFILL_COPY.selectBooking}</p>
        {elig.message && <LiffStatus message={elig.message} variant="error" />}
        <ul className="space-y-2">
          {elig.bookings.map((b) => (
            <li key={b.appointmentId}>
              <button
                type="button"
                className="w-full rounded-xl border bg-card p-4 text-left min-h-[72px] hover:border-primary/40"
                onClick={() => {
                  setAppointmentId(b.appointmentId);
                  setStep('confirm');
                }}
              >
                <p className="font-medium">{b.petName ?? elig.petName ?? '毛孩'}</p>
                <p className="text-sm text-muted-foreground">
                  {b.merchantName} · {b.date} {b.time}
                </p>
                {b.activeOrderId ? (
                  <p className="mt-1 text-xs text-amber-700">已有換罐訂單</p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // confirm
  const booking =
    elig?.bookings.find((b) => b.appointmentId === appointmentId) ?? elig?.selectedBooking;
  const amount = elig?.amount ?? 99;
  const priceLabel =
    elig?.orderType === 'exchange' ? REFILL_COPY.exchangePrice : REFILL_COPY.firstPrice;

  return (
    <div className="space-y-5">
      {elig?.message && <LiffStatus message={elig.message} variant="error" />}
      <dl className="space-y-2 text-sm">
        <Row label="毛孩" value={booking?.petName ?? elig?.petName ?? '—'} />
        <Row label="店家" value={booking?.merchantName ?? '—'} />
        <Row label="日期" value={booking ? `${booking.date} ${booking.time}` : '—'} />
        <Row label="項目" value="換罐計畫" />
        <Row label="金額" value={`NT$${amount}`} />
      </dl>
      <p className="text-base font-semibold">{priceLabel}</p>
      {error && <LiffStatus message={error} variant="error" />}
      <Button
        type="button"
        className="w-full min-h-[52px] text-base"
        disabled={busy || !appointmentId}
        onClick={onConfirmPay}
      >
        {busy ? '處理中…' : REFILL_COPY.confirmPayAmount(amount)}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        此筆款項付給匠寵｜美容費用請另外付給店家
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
