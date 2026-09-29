'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { BadgeCheck, TicketCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Coupon = {
  couponCode: string;
  storeName: string;
  discountAmount: number;
  status: string;
  expiresAt: string;
  redeemedAt: string | null;
};

type HistoryRow = {
  couponCode: string;
  discountAmount: number;
  redeemedAt: string | null;
  redeemedBy: string | null;
  customerName: string;
};

type Result =
  | { ok: true; coupon: Coupon; customerName?: string }
  | { ok: false; error: string };

export function CouponRedemptionWorkspace({ storeName }: { storeName: string }) {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [pending, setPending] = useState(false);

  async function loadHistory() {
    const response = await fetch('/api/merchant/coupons', { cache: 'no-store' });
    const data = await response.json();
    if (data.ok) setHistory(data.rows ?? []);
  }

  useEffect(() => { void loadHistory(); }, []);

  async function submit(action: 'verify' | 'redeem') {
    setPending(true);
    const response = await fetch('/api/merchant/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, couponCode: code }),
    });
    const data = await response.json();
    setResult(data);
    setPending(false);
    if (data.ok && action === 'redeem') {
      setCode('');
      await loadHistory();
    }
  }

  function verify(event: FormEvent) {
    event.preventDefault();
    if (code.trim()) void submit('verify');
  }

  const verified = result?.ok && result.coupon.status === 'available';

  return (
    <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 md:px-8">
      <header>
        <p className="text-sm font-semibold text-primary">匠寵會員服務</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">美容券核銷</h1>
        <p className="mt-2 text-sm text-muted-foreground">輸入會員 LINE 顯示的折價券序號，由系統核對會員與使用資格。</p>
      </header>

      <section className="rounded-3xl border border-primary/20 bg-card p-5 shadow-card md:p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="rounded-2xl bg-primary/10 p-3 text-primary"><TicketCheck className="h-6 w-6" /></span>
          <div><p className="font-semibold">核銷店家</p><p className="text-sm text-muted-foreground">{storeName}</p></div>
        </div>
        <form onSubmit={verify} className="flex flex-col gap-3 sm:flex-row">
          <Input
            value={code}
            onChange={(event) => { setCode(event.target.value.toUpperCase()); setResult(null); }}
            placeholder="例如 FURMOSA-1234"
            autoComplete="off"
            className="min-h-12 flex-1 font-mono text-lg tracking-wider"
          />
          <Button className="min-h-12 px-8" disabled={pending || !code.trim()}>{pending ? '核對中…' : '核對折價券'}</Button>
        </form>

        {result && !result.ok ? <p className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{result.error}</p> : null}
        {result?.ok ? (
          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="flex items-center gap-2 font-semibold text-primary"><BadgeCheck className="h-5 w-5" />資料核對完成</div>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">會員</dt><dd className="font-semibold">{result.customerName ?? '會員'}</dd></div>
              <div><dt className="text-muted-foreground">折抵金額</dt><dd className="font-semibold">NT${result.coupon.discountAmount}</dd></div>
              <div><dt className="text-muted-foreground">折價券序號</dt><dd className="font-mono">{result.coupon.couponCode}</dd></div>
              <div><dt className="text-muted-foreground">有效期限</dt><dd>{format(new Date(result.coupon.expiresAt), 'yyyy/MM/dd')}</dd></div>
            </dl>
            {verified ? <Button type="button" className="mt-5 min-h-12 w-full" disabled={pending} onClick={() => void submit('redeem')}>{pending ? '核銷中…' : `確認核銷 NT$${result.coupon.discountAmount}`}</Button> : null}
            {result.coupon.status === 'redeemed' ? <p className="mt-4 font-semibold text-primary">已完成核銷，紀錄已送入對帳。</p> : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-3xl border bg-card p-5 shadow-sm md:p-7">
        <h2 className="text-xl font-bold">最近核銷紀錄</h2>
        <p className="mt-1 text-sm text-muted-foreground">顯示最近 20 筆，對帳系統會使用相同核銷資料。</p>
        <div className="mt-4 divide-y">
          {history.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">目前沒有核銷紀錄</p> : history.map((row) => (
            <div key={`${row.couponCode}-${row.redeemedAt}`} className="grid gap-1 py-4 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center">
              <div><p className="font-semibold">{row.customerName}</p><p className="font-mono text-muted-foreground">{row.couponCode}</p></div>
              <div className="text-muted-foreground">{row.redeemedAt ? format(new Date(row.redeemedAt), 'yyyy/MM/dd HH:mm') : '—'} · {row.redeemedBy ?? '店員'}</div>
              <p className="font-semibold text-primary">NT${row.discountAmount}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
