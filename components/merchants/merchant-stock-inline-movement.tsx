'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { adjustMerchantStock } from '@/app/(main)/merchants/[id]/actions';
import { isNextRedirect } from '@/lib/is-next-redirect';
import {
  STOCK_DECREASE_REASON_OPTIONS,
  STOCK_INCREASE_REASON_OPTIONS,
  type StockMovementReason,
} from '@/lib/merchant-stock-movement';
import {
  MerchantStockUndoToast,
  type StockUndoToast,
} from '@/components/merchants/merchant-stock-undo-toast';

export function MerchantStockInlineMovement({
  merchantId,
  productId,
  productName,
  tierId = '',
  tierLabel,
  quantity,
  unitPrice,
  commissionPercent,
  compact = false,
}: {
  merchantId: string;
  productId: string;
  productName: string;
  tierId?: string;
  tierLabel?: string | null;
  quantity: number;
  unitPrice: number | null;
  commissionPercent: number | null;
  /** 手機卡片用較大控件 */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(quantity));
  const [showAlt, setShowAlt] = useState(false);
  const [reason, setReason] = useState<StockMovementReason>('sale');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<StockUndoToast | null>(null);

  const delta = useMemo(() => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n - quantity;
  }, [value, quantity]);

  const defaultReason: StockMovementReason =
    delta != null && delta < 0 ? 'sale' : 'restock_correction';
  const activeReason = showAlt ? reason : defaultReason;
  const altOptions =
    delta != null && delta < 0
      ? STOCK_DECREASE_REASON_OPTIONS.filter((o) => o.value !== 'sale')
      : STOCK_INCREASE_REASON_OPTIONS.filter((o) => o.value !== 'restock_correction');

  const previewText = useMemo(() => {
    if (delta == null || delta === 0) return null;
    if (delta < 0 && activeReason === 'sale') {
      const qty = Math.abs(delta);
      const price = unitPrice ?? 0;
      const pct = commissionPercent ?? 0;
      const commission = (price * pct * qty) / 100;
      return `記為現場售出 ${qty} 件・分潤約 ${formatCurrency(commission)}`;
    }
    if (delta < 0) {
      const label =
        STOCK_DECREASE_REASON_OPTIONS.find((o) => o.value === activeReason)?.label ?? '減少';
      return `記為${label}・不計分潤`;
    }
    const label =
      STOCK_INCREASE_REASON_OPTIONS.find((o) => o.value === activeReason)?.label ?? '增加';
    return `記為${label}・不計銷售`;
  }, [delta, activeReason, unitPrice, commissionPercent]);

  const qtyClass =
    quantity === 0
      ? 'font-mono font-semibold text-destructive'
      : quantity <= 3
        ? 'font-mono font-semibold text-warning'
        : 'font-mono font-semibold';

  function bump(n: number) {
    const cur = Number(value);
    const next = Number.isFinite(cur) ? Math.max(0, cur + n) : Math.max(0, quantity + n);
    setValue(String(next));
  }

  function submit() {
    setError(null);
    const next = Number(value);
    if (!Number.isFinite(next) || next < 0) {
      setError('請輸入 0 或正整數');
      return;
    }
    if (next === quantity) {
      setError('數量沒有變化');
      return;
    }
    if (activeReason === 'damage' && !note.trim()) {
      setError('盤損／報廢請填寫備註');
      return;
    }
    const fd = new FormData();
    fd.set('merchantId', merchantId);
    fd.set('productId', productId);
    if (tierId) fd.set('tierId', tierId);
    fd.set('newQuantity', String(next));
    fd.set('reason', activeReason);
    if (note.trim()) fd.set('note', note.trim());
    fd.set('softRefresh', '1');

    startTransition(async () => {
      try {
        const result = await adjustMerchantStock(fd);
        if (result && 'txnId' in result) {
          setToast({
            txnId: result.txnId,
            tierId: result.tierId,
            summary: result.summary,
          });
        }
        setOpen(false);
        setShowAlt(false);
        router.refresh();
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError(e instanceof Error ? e.message : '送出失敗');
      }
    });
  }

  return (
    <div className="w-full">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setValue(String(quantity));
            setShowAlt(false);
            setReason(delta != null && delta > 0 ? 'restock_correction' : 'sale');
            setNote('');
            setError(null);
            setOpen(true);
          }}
          className="group flex w-full flex-col items-end gap-0.5 rounded-md px-1 py-0.5 text-right hover:bg-muted/40"
        >
          <span className={`${qtyClass} ${compact ? 'text-2xl' : 'text-lg'}`}>{quantity}</span>
          <span className="text-[11px] font-medium text-primary group-hover:underline">
            清點
          </span>
        </button>
      ) : (
        <div className="space-y-2 rounded-md border bg-muted/15 p-2 text-left sm:min-w-[16rem]">
          {tierLabel ? (
            <div className="text-xs text-muted-foreground">{productName}・{tierLabel}</div>
          ) : null}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
              onClick={() => bump(-1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <input
              type="number"
              min={0}
              step={1}
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
                if (e.key === 'Escape') setOpen(false);
              }}
              className="h-9 flex-1 rounded-md border bg-background px-2 text-center font-mono text-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-9 shrink-0"
              onClick={() => bump(1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {delta != null && delta !== 0 ? (
            <p
              className={
                delta < 0 ? 'text-xs font-medium text-destructive' : 'text-xs font-medium text-success'
              }
            >
              {delta < 0 ? `少了 ${Math.abs(delta)} 件` : `多了 ${delta} 件`}
              {previewText ? ` · ${previewText}` : null}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">調整數量後即可完成</p>
          )}

          {delta != null && delta !== 0 ? (
            <div>
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setShowAlt((v) => !v);
                  if (!showAlt) {
                    setReason(delta < 0 ? 'damage' : 'count_correction');
                  }
                }}
              >
                {delta < 0 ? '不是賣出？' : '不是補登進貨？'}
              </button>
              {showAlt ? (
                <div className="mt-1 space-y-1">
                  {altOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex cursor-pointer gap-2 rounded border bg-background px-2 py-1.5 text-xs has-[:checked]:border-primary"
                    >
                      <input
                        type="radio"
                        checked={reason === opt.value}
                        onChange={() => setReason(opt.value)}
                      />
                      <span>
                        <span className="font-medium">{opt.label}</span>
                        <span className="block text-muted-foreground">{opt.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeReason === 'damage' ? (
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">盤損備註（必填）</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：過期／包裝破損"
                className="h-8 w-full rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ) : null}

          {error ? <p className="text-xs text-destructive">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || delta == null || delta === 0}
              onClick={submit}
            >
              {pending ? '處理中…' : '完成'}
            </Button>
          </div>
        </div>
      )}

      <MerchantStockUndoToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
