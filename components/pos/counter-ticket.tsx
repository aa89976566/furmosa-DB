'use client';

import { useFormStatus } from 'react-dom';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  cartItemCount,
  cartSubtotal,
  setCartLineQty,
  type CounterCartLine,
} from '@/lib/pos/counter-cart';

type Phase = 'edit' | 'confirm' | 'done';

export function CounterTicket({
  storeName,
  lines,
  phase,
  error,
  doneTotal,
  onChangeLines,
  onAskConfirm,
  onCancelConfirm,
  onNewTicket,
}: {
  storeName: string;
  lines: CounterCartLine[];
  phase: Phase;
  error: string | null;
  doneTotal: number | null;
  onChangeLines: (lines: CounterCartLine[]) => void;
  onAskConfirm: () => void;
  onCancelConfirm: () => void;
  onNewTicket: () => void;
}) {
  const { pending } = useFormStatus();
  const count = cartItemCount(lines);
  const total = cartSubtotal(lines);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="px-5 pb-4 pt-5">
        <p className="text-xs font-medium text-muted-foreground">本單</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-navy">{storeName}</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-1">
        {phase === 'done' ? (
          <div className="rounded-2xl bg-muted/70 px-4 py-6">
            <p className="text-sm text-muted-foreground">已收款</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-navy">
              {formatCurrency(doneTotal ?? 0)}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">把商品交給客人就可以了。</p>
          </div>
        ) : lines.length === 0 ? (
          <p className="py-10 text-sm text-muted-foreground">點商品上的 ＋ 加入本單。</p>
        ) : (
          <ul className="space-y-4">
            {lines.map((line) => (
              <li key={line.key} className="flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-muted">
                  {line.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={line.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-lg font-semibold text-navy/50">{line.name.slice(0, 1)}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-navy">{line.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {line.specLabel ? `${line.specLabel} · ` : ''}
                    {formatCurrency(line.unitPrice)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-muted"
                    onClick={() => onChangeLines(setCartLineQty(lines, line.key, line.qty - 1))}
                    aria-label={`減少 ${line.name}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-5 text-center text-sm font-semibold">{line.qty}</span>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white disabled:bg-muted disabled:text-muted-foreground"
                    onClick={() => onChangeLines(setCartLineQty(lines, line.key, line.qty + 1))}
                    disabled={line.qty >= line.stock}
                    aria-label={`增加 ${line.name}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 pb-5 pt-3">
        {error ? (
          <p className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        ) : null}
        {phase === 'done' ? (
          <Button type="button" className="min-h-[52px] w-full rounded-full text-base" onClick={onNewTicket}>
            下一筆
          </Button>
        ) : phase === 'confirm' ? (
          <div className="space-y-3">
            <p className="text-sm text-navy">
              已收到現金 {formatCurrency(total)}，把商品交給客人？
            </p>
            <Button
              type="submit"
              className="min-h-[52px] w-full rounded-full text-base"
              disabled={pending}
            >
              {pending ? '記帳中…' : '確認完成'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px] w-full"
              onClick={onCancelConfirm}
              disabled={pending}
            >
              返回本單
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2 rounded-2xl bg-muted/70 px-4 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">小計</span>
                <span className="text-navy">{formatCurrency(total)}</span>
              </div>
              <div className="flex items-end justify-between pt-1">
                <span className="text-sm font-semibold text-navy">
                  合計
                  <span className="ml-2 font-normal text-muted-foreground">{count} 件</span>
                </span>
                <span className="text-2xl font-semibold tracking-tight text-navy">
                  {formatCurrency(total)}
                </span>
              </div>
            </div>
            <Button
              type="button"
              className="min-h-[52px] w-full rounded-full text-base"
              disabled={lines.length === 0}
              onClick={onAskConfirm}
            >
              確認收款
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
