'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { adjustMerchantStock } from '@/app/(main)/merchants/[id]/actions';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  STOCK_DECREASE_REASON_OPTIONS,
  STOCK_INCREASE_REASON_OPTIONS,
  type StockMovementReason,
} from '@/lib/merchant-stock-movement';

export function MerchantStockMovementDialog({
  merchantId,
  productId,
  productName,
  tierId = '',
  tierLabel,
  quantity,
  unitPrice,
  commissionPercent,
  returnTo,
  open,
  onClose,
}: {
  merchantId: string;
  productId: string;
  productName: string;
  tierId?: string;
  tierLabel?: string | null;
  quantity: number;
  unitPrice: number | null;
  commissionPercent: number | null;
  returnTo?: string;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [actualQty, setActualQty] = useState(String(quantity));
  const [reason, setReason] = useState<StockMovementReason>('sale');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const delta = useMemo(() => {
    const n = Number(actualQty);
    if (!Number.isFinite(n)) return null;
    return n - quantity;
  }, [actualQty, quantity]);

  const reasonOptions =
    delta != null && delta < 0
      ? STOCK_DECREASE_REASON_OPTIONS
      : delta != null && delta > 0
        ? STOCK_INCREASE_REASON_OPTIONS
        : [];

  const activeReason =
    reasonOptions.find((o) => o.value === reason) ?? reasonOptions[0] ?? null;

  const salePreview = useMemo(() => {
    if (!activeReason?.countsAsSale || delta == null || delta >= 0) return null;
    const price = unitPrice ?? 0;
    const pct = commissionPercent ?? 0;
    const qty = Math.abs(delta);
    const commission = (price * pct * qty) / 100;
    const gross = price * qty;
    return { price, pct, qty, commission, gross, company: gross - commission };
  }, [activeReason, delta, unitPrice, commissionPercent]);

  if (!open) return null;

  const title = tierLabel ? `${productName}（${tierLabel}）` : productName;

  function submit() {
    setError(null);
    const next = Number(actualQty);
    if (!Number.isFinite(next) || next < 0) {
      setError('請輸入 0 或正整數');
      return;
    }
    if (next === quantity) {
      setError('數量沒有變化');
      return;
    }
    const chosen =
      (next - quantity < 0
        ? STOCK_DECREASE_REASON_OPTIONS
        : STOCK_INCREASE_REASON_OPTIONS
      ).find((o) => o.value === reason) ??
      (next - quantity < 0
        ? STOCK_DECREASE_REASON_OPTIONS[0]
        : STOCK_INCREASE_REASON_OPTIONS[1]);
    if (chosen.value === 'damage' && !note.trim()) {
      setError('盤損／報廢請填寫備註');
      return;
    }

    const fd = new FormData();
    fd.set('merchantId', merchantId);
    fd.set('productId', productId);
    if (tierId) fd.set('tierId', tierId);
    fd.set('newQuantity', String(next));
    fd.set('reason', chosen.value);
    fd.set('softRefresh', '1');
    if (returnTo) fd.set('returnTo', returnTo);
    if (note.trim()) fd.set('note', note.trim());

    startTransition(async () => {
      try {
        await adjustMerchantStock(fd);
        onClose();
        router.refresh();
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError(e instanceof Error ? e.message : '送出失敗');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between border-b px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">登記庫存異動</h2>
            <p className="text-xs text-muted-foreground">{title}</p>
          </div>
          <Button type="button" size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">目前系統庫存</div>
              <div className="mt-1 font-mono text-xl font-semibold">{quantity}</div>
            </div>
            <div className="rounded-md border p-3">
              <label className="text-xs text-muted-foreground" htmlFor="actualQty">
                現場實際數量
              </label>
              <input
                id="actualQty"
                type="number"
                min={0}
                step={1}
                value={actualQty}
                onChange={(e) => {
                  setActualQty(e.target.value);
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  const d = n - quantity;
                  if (d < 0) setReason('sale');
                  else if (d > 0) setReason('count_correction');
                }}
                className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 font-mono text-lg"
              />
            </div>
          </div>

          {delta != null && delta !== 0 ? (
            <p
              className={
                delta < 0
                  ? 'text-sm font-medium text-destructive'
                  : 'text-sm font-medium text-success'
              }
            >
              {delta < 0 ? `減少 ${Math.abs(delta)} 件` : `增加 ${delta} 件`}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">請輸入與系統不同的數量</p>
          )}

          {reasonOptions.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">原因（必選）</div>
              <div className="space-y-2">
                {reasonOptions.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer gap-3 rounded-md border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5`}
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={opt.value}
                      checked={reason === opt.value}
                      onChange={() => setReason(opt.value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-medium">{opt.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <label htmlFor="note" className="text-sm font-medium">
              備註{activeReason?.value === 'damage' ? '（必填）' : '（選填）'}
            </label>
            <textarea
              id="note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="block w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="例如：包裝破損、忘了登記進貨…"
            />
          </div>

          <div className="rounded-md border bg-muted/20 p-3 text-sm">
            <div className="font-medium">這筆異動會發生什麼</div>
            {delta == null || delta === 0 ? (
              <p className="mt-1 text-muted-foreground">數量有變化後才可預覽</p>
            ) : salePreview ? (
              <p className="mt-1 leading-relaxed">
                將記錄 {salePreview.qty} 件現場售出，單價{' '}
                {formatCurrency(salePreview.price)}，店家分潤 {salePreview.pct}% ={' '}
                {formatCurrency(salePreview.commission)}，公司實收{' '}
                {formatCurrency(salePreview.company)}。
              </p>
            ) : (
              <p className="mt-1 leading-relaxed">
                將記錄 {Math.abs(delta)} 件「{activeReason?.label ?? '異動'}」
                ，不影響分潤／結算金額。
              </p>
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              取消
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={pending || delta == null || delta === 0}
            >
              {pending ? '處理中…' : '確認登記'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
