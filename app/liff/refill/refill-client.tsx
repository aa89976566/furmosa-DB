'use client';

import { useCallback, useEffect, useState } from 'react';
import { LiffShell } from '@/components/liff/liff-shell';
import { LiffStatus } from '@/components/liff/liff-status';
import { Button } from '@/components/ui/button';
import { REFILL_COPY } from '@/lib/refill/copy';

type Props = {
  liffId: string;
  storeId: string | null;
  orderId: string | null;
  paidHint: boolean;
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
  | 'confirm'
  | 'paying'
  | 'success'
  | 'confirming'
  | 'view'
  | 'error';

export function LiffRefillClient(props: Props) {
  return (
    <LiffShell liffId={props.liffId} title={REFILL_COPY.ctaWantRefill}>
      {({ idToken }) => <RefillFlow idToken={idToken} {...props} />}
    </LiffShell>
  );
}

function RefillFlow({
  idToken,
  storeId,
  orderId,
  paidHint,
}: Props & { idToken: string }) {
  const [step, setStep] = useState<Step>(paidHint || orderId ? 'confirming' : 'load');
  const [error, setError] = useState<string | null>(null);
  const [elig, setElig] = useState<Eligibility | null>(null);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [busy, setBusy] = useState(false);

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
            setError('付款確認還在處理，請稍後再打開查看。');
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
        if (e.bookings.length === 0) {
          setError(REFILL_COPY.noBooking);
          setStep('error');
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
  }, [orderId, loadEligibility, loadOrder]);

  async function onConfirmPay() {
    if (!appointmentId) return;
    setBusy(true);
    setError(null);
    try {
      const createRes = await fetch('/api/refill/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          appointmentId,
          amount: 1, // 故意錯誤金額；後端必須忽略
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error ?? REFILL_COPY.genericError);
      const oid = created.order.id as string;
      setOrder(created.order);

      if (
        created.order.status === 'paid_waiting_return' ||
        created.order.status === 'payment_pending'
      ) {
        /* continue */
      }

      const payRes = await fetch(`/api/refill/orders/${oid}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const pay = await payRes.json();
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
      setStep('confirm');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'register') {
    const returnTo = encodeURIComponent(
      `/liff/refill${storeId ? `?storeId=${storeId}` : ''}`,
    );
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">請先完成會員註冊，再回來換罐付款。</p>
        <Button asChild className="w-full min-h-[48px]">
          <a href={`/liff/register?return=${returnTo}`}>前往註冊</a>
        </Button>
      </div>
    );
  }

  if (step === 'load' || step === 'paying') {
    return <p className="text-sm text-muted-foreground">請稍候…</p>;
  }

  if (step === 'confirming') {
    return (
      <div className="space-y-3">
        <p className="text-lg font-semibold">{REFILL_COPY.confirmingPayment}</p>
        <p className="text-sm text-muted-foreground">我們正在向銀行確認，請不要關閉頁面。</p>
        {error && <LiffStatus message={error} variant="error" />}
      </div>
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
            到店後，請帶空罐給店員。店家確認序號後，就可以領取新罐。
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
        <p className="text-sm font-medium text-foreground">{REFILL_COPY.rememberEmptyJar}</p>
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
        付款給匠寵。美容費請另外付給店家。
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
