'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCouponStatus } from '@/lib/coupons/labels';
import type { CouponStatus } from '@/lib/coupons/constants';

const STORE_STORAGE_KEY = 'furmosa-redeem-store-slug';

export type RedeemStoreOption = {
  slug: string;
  name: string;
};

type CouponPayload = {
  id: string;
  couponCode: string;
  storeId: string;
  storeName: string;
  discountAmount: number;
  status: CouponStatus;
  expiresAt: string;
  redeemedAt: string | null;
  redeemedStore: string | null;
  customerName?: string;
};

type VerifyResult =
  | { ok: true; coupon: CouponPayload; customerName: string }
  | { ok: false; error: string; coupon?: CouponPayload };

type RedeemResult =
  | { ok: true; coupon: CouponPayload }
  | { ok: false; error: string; coupon?: CouponPayload };

async function verifyCoupon(storeId: string, couponCode: string): Promise<VerifyResult> {
  const res = await fetch('/api/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ couponCode, storeId, action: 'verify' }),
  });
  return res.json();
}

async function redeemCoupon(
  storeId: string,
  couponCode: string,
  redeemedBy?: string,
): Promise<RedeemResult> {
  const res = await fetch('/api/coupons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ couponCode, storeId, action: 'redeem', redeemedBy }),
  });
  return res.json();
}

function CouponDetail({
  coupon,
  customerName,
  showRedeemForm,
  storeId,
  onRedeemed,
}: {
  coupon: CouponPayload;
  customerName?: string;
  showRedeemForm?: boolean;
  storeId: string;
  onRedeemed: (result: RedeemResult) => void;
}) {
  const [redeemedBy, setRedeemedBy] = useState('');
  const [pending, setPending] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [done, setDone] = useState<RedeemResult | null>(null);

  if (done?.ok) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/5 p-5 space-y-2">
        <p className="text-lg font-semibold text-success">✅ 優惠券已成功核銷</p>
        <dl className="space-y-1 text-sm">
          <div>
            <dt className="text-muted-foreground">優惠碼</dt>
            <dd className="font-mono font-semibold">{done.coupon.couponCode}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">折抵</dt>
            <dd>{done.coupon.discountAmount} 元</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">核銷時間</dt>
            <dd>
              {done.coupon.redeemedAt
                ? format(new Date(done.coupon.redeemedAt), 'yyyy/MM/dd HH:mm')
                : '—'}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
      <dl className="grid gap-2 text-sm">
        {customerName ? (
          <div>
            <dt className="text-muted-foreground">會員</dt>
            <dd className="font-medium">{customerName}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">店家</dt>
          <dd>{coupon.storeName}</dd>
        </div>
        {showRedeemForm ? (
          <>
            <div>
              <dt className="text-muted-foreground">折抵</dt>
              <dd>{coupon.discountAmount} 元</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">狀態</dt>
              <dd>{formatCouponStatus(coupon.status)}</dd>
            </div>
          </>
        ) : (
          <>
            <div>
              <dt className="text-muted-foreground">優惠券編號</dt>
              <dd className="font-mono font-semibold">{coupon.couponCode}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">折抵金額</dt>
              <dd>{coupon.discountAmount} 元</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">有效期限</dt>
              <dd>{format(new Date(coupon.expiresAt), 'yyyy/MM/dd')}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">狀態</dt>
              <dd>{formatCouponStatus(coupon.status)}</dd>
            </div>
          </>
        )}
        {coupon.status === 'redeemed' && coupon.redeemedAt ? (
          <>
            <div>
              <dt className="text-muted-foreground">核銷店家</dt>
              <dd>{coupon.redeemedStore ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">核銷時間</dt>
              <dd>{format(new Date(coupon.redeemedAt), 'yyyy/MM/dd HH:mm')}</dd>
            </div>
          </>
        ) : null}
      </dl>

      {showRedeemForm ? (
        <div className="space-y-3 border-t pt-4">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">店員名稱（選填）</label>
            <Input
              value={redeemedBy}
              onChange={(e) => setRedeemedBy(e.target.value)}
              placeholder="例：小美"
            />
          </div>
          {redeemError ? (
            <p className="text-sm text-destructive whitespace-pre-line">{redeemError}</p>
          ) : null}
          <Button
            className="w-full"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setRedeemError(null);
              const result = await redeemCoupon(storeId, coupon.couponCode, redeemedBy);
              setPending(false);
              if (!result.ok) {
                setRedeemError(result.error);
                onRedeemed(result);
                return;
              }
              setDone(result);
              onRedeemed(result);
            }}
          >
            {pending ? '核銷中…' : '確認核銷'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function StoreCouponRedeemForm({
  stores,
  defaultStoreSlug,
  lockedStoreSlug,
}: {
  stores: RedeemStoreOption[];
  defaultStoreSlug?: string;
  /** 專屬連結進入時鎖定店家，隱藏下拉選單 */
  lockedStoreSlug?: string;
}) {
  const locked =
    lockedStoreSlug && stores.some((s) => s.slug === lockedStoreSlug) ? lockedStoreSlug : '';
  const [storeId, setStoreId] = useState(locked || '');
  const [couponCode, setCouponCode] = useState('');
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (locked) {
      setStoreId(locked);
      return;
    }
    const initial =
      defaultStoreSlug && stores.some((s) => s.slug === defaultStoreSlug)
        ? defaultStoreSlug
        : typeof window !== 'undefined'
          ? localStorage.getItem(STORE_STORAGE_KEY)
          : null;
    if (initial && stores.some((s) => s.slug === initial)) {
      setStoreId(initial);
    }
  }, [defaultStoreSlug, locked, stores]);

  function onStoreChange(slug: string) {
    setStoreId(slug);
    setState(null);
    if (typeof window !== 'undefined' && slug) {
      localStorage.setItem(STORE_STORAGE_KEY, slug);
    }
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    const code = couponCode.trim();
    if (!storeId) {
      alert('請先選擇店家');
      return;
    }
    if (!code) return;
    setPending(true);
    const result = await verifyCoupon(storeId, code);
    setPending(false);
    setState(result);
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleVerify}
        className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">驗證店家</label>
          {locked ? (
            <>
              <input type="hidden" name="storeId" value={storeId} />
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium">
                {stores.find((s) => s.slug === locked)?.name ?? locked}
              </div>
            </>
          ) : (
            <select
              value={storeId}
              onChange={(e) => onStoreChange(e.target.value)}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">請選擇您的店家</option>
              {stores.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {!locked ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              選擇後會記住，下次開啟自動帶入（僅此裝置）。
            </p>
          ) : null}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">請輸入優惠碼</label>
          <Input
            name="couponCode"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            placeholder="FURMOSA-1234"
            className="font-mono text-center text-lg tracking-widest"
            required
            autoComplete="off"
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending || !storeId}>
          {pending ? '驗證中…' : '驗證優惠券'}
        </Button>
      </form>

      {state && !state.ok ? (
        <div className="space-y-3">
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive whitespace-pre-line">
            {state.error}
          </p>
          {state.coupon ? (
            <CouponDetail
              coupon={state.coupon}
              customerName={state.coupon.customerName}
              storeId={storeId}
              onRedeemed={() => {}}
            />
          ) : null}
        </div>
      ) : null}

      {state?.ok ? (
        <CouponDetail
          coupon={state.coupon}
          customerName={state.customerName}
          showRedeemForm
          storeId={storeId}
          onRedeemed={() => {}}
        />
      ) : null}
    </div>
  );
}
