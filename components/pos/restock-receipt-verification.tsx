'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, Minus, Plus } from 'lucide-react';
import { ProductCover } from '@/components/pos/product-cover';
import { Button } from '@/components/ui/button';

export type ReceiptVerificationItem = {
  lineId: string;
  productId: string;
  name: string;
  sku: string;
  specification: string;
  imageUrl: string | null;
  expectedQuantity: number;
};

export function RestockReceiptVerification({
  requestId,
  items,
  action,
}: {
  requestId: string;
  items: ReceiptVerificationItem[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() =>
    Object.fromEntries(items.map((item) => [item.lineId, item.expectedQuantity])),
  );
  const [issues, setIssues] = useState<Record<string, boolean>>({});
  const allCorrect = useMemo(
    () =>
      items.every(
        (item) =>
          quantities[item.lineId] === item.expectedQuantity && !issues[item.lineId],
      ),
    [items, issues, quantities],
  );

  const verifiedCount = items.filter(
    (item) => quantities[item.lineId] === item.expectedQuantity && !issues[item.lineId],
  ).length;
  const receivedTotal = items.reduce(
    (total, item) => total + (quantities[item.lineId] ?? 0),
    0,
  );

  function changeQuantity(productId: string, delta: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, (current[productId] ?? 0) + delta),
    }));
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="requestId" value={requestId} />
      <section className="rounded-2xl border bg-card p-5 md:p-6">
        <h2 className="text-base font-semibold md:text-lg">驗收品項</h2>
        <div className="mt-4 divide-y">
          {items.map((item) => {
            const quantity = quantities[item.lineId] ?? 0;
            const correct = quantity === item.expectedQuantity && !issues[item.lineId];
            return (
              <div
                key={item.lineId}
                className="grid gap-4 py-5 first:pt-2 md:grid-cols-[168px_minmax(0,1fr)] md:items-center"
              >
                <ProductCover
                  name={item.name}
                  imageUrl={item.imageUrl}
                  imgClassName="h-40 w-full rounded-xl bg-muted object-contain md:h-44"
                  markClassName="flex h-40 w-full items-center justify-center rounded-xl bg-muted text-4xl font-semibold text-muted-foreground md:h-44"
                />
                <div className="min-w-0 space-y-4">
                  <div>
                    <p className="font-semibold text-foreground">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.sku}</p>
                    <p className="text-sm text-muted-foreground">{item.specification}</p>
                    <p className="mt-3 text-sm">
                      <span className="text-muted-foreground">應收</span>{' '}
                      <span className="ml-2 font-medium">{item.expectedQuantity}</span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 md:justify-end">
                    <span className="text-sm text-muted-foreground">實收</span>
                    <div className="flex items-center rounded-xl border p-1">
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.lineId, -1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30"
                        disabled={quantity === 0}
                        aria-label={`${item.name} 減少一件`}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center font-semibold" aria-live="polite">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => changeQuantity(item.lineId, 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                        aria-label={`${item.name} 增加一件`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <span
                      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ${
                        correct
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-900'
                      }`}
                    >
                      {correct ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      {correct ? '數量正確' : '需要確認'}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10"
                      onClick={() =>
                        setIssues((current) => ({
                          ...current,
                          [item.lineId]: !current[item.lineId],
                        }))
                      }
                    >
                      {issues[item.lineId] ? '取消異常標記' : '回報缺少／破損'}
                    </Button>
                  </div>
                  {issues[item.lineId] ? (
                    <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">
                      已標記商品異常。請先暫停收貨並聯絡 HQ，確認處理方式後再入庫。
                    </p>
                  ) : null}
                  <input
                    type="hidden"
                    name={`received:${item.lineId}`}
                    value={quantity}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">
          已核對 {verifiedCount} / {items.length} 項 · 實收 {receivedTotal} 件
        </p>
        {!allCorrect ? (
          <p className="text-sm font-medium text-amber-900">請先確認所有品項與數量</p>
        ) : null}
      </div>

      <Button type="submit" className="min-h-14 w-full text-base" disabled={!allCorrect}>
        確認收貨並加入庫存
      </Button>
    </form>
  );
}
