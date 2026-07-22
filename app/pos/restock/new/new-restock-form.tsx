'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  submitAutoReplenishRestockAction,
  submitSelfSelectRestockAction,
  type PosRestockFormState,
} from '../actions';

type ProductOption = {
  id: string;
  name: string;
  unit: string;
  stockQty: number | null;
};

const initial: PosRestockFormState = {};

export function NewRestockForm({ products }: { products: ProductOption[] }) {
  const [mode, setMode] = useState<'SELF_SELECT' | 'AUTO_REPLENISH' | null>(
    null,
  );
  const [qty, setQty] = useState<Record<string, number>>({});

  const selfState = useFormState(submitSelfSelectRestockAction, initial);
  const autoState = useFormState(submitAutoReplenishRestockAction, initial);

  const selectedCount = useMemo(
    () => Object.values(qty).filter((n) => n > 0).length,
    [qty],
  );

  if (!mode) {
    return (
      <div className="grid gap-3">
        <Button
          type="button"
          className="min-h-[52px] w-full text-base"
          onClick={() => setMode('SELF_SELECT')}
        >
          我要自己選
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-[52px] w-full text-base"
          onClick={() => setMode('AUTO_REPLENISH')}
        >
          請幫我配
        </Button>
      </div>
    );
  }

  if (mode === 'AUTO_REPLENISH') {
    const [state, action] = autoState;
    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          <button
            type="button"
            className="text-xs text-muted-foreground"
            onClick={() => setMode(null)}
          >
            ← 重選方式
          </button>
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="merchantNote">
                告訴我們你需要什麼
              </label>
              <textarea
                id="merchantNote"
                name="merchantNote"
                required
                rows={4}
                className="w-full rounded-xl border border-input bg-card px-3 py-2 text-sm"
                placeholder="例如：雞肉口味快沒了，幫我配一箱常用款"
              />
            </div>
            {state.error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            <Submit label="送出申請" />
          </form>
        </CardContent>
      </Card>
    );
  }

  const [state, action] = selfState;
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <button
          type="button"
          className="text-xs text-muted-foreground"
          onClick={() => setMode(null)}
        >
          ← 重選方式
        </button>
        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            目前沒有可叫貨的商品，請聯繫 Furmosa。
          </p>
        ) : (
          <form action={action} className="space-y-4">
            <div className="space-y-3">
              {products.map((p) => {
                const value = qty[p.id] ?? 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      {p.stockQty !== null ? (
                        <p className="text-xs text-muted-foreground">
                          門市現有 {p.stockQty} {p.unit}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">門市庫存未登記</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-11 min-h-[44px] p-0"
                        onClick={() =>
                          setQty((prev) => ({
                            ...prev,
                            [p.id]: Math.max(0, (prev[p.id] ?? 0) - 1),
                          }))
                        }
                      >
                        −
                      </Button>
                      <Input
                        name="quantity"
                        type="number"
                        min={0}
                        className="h-11 w-16 text-center"
                        value={value}
                        onChange={(e) =>
                          setQty((prev) => ({
                            ...prev,
                            [p.id]: Math.max(0, Number(e.target.value) || 0),
                          }))
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-11 min-h-[44px] p-0"
                        onClick={() =>
                          setQty((prev) => ({
                            ...prev,
                            [p.id]: (prev[p.id] ?? 0) + 1,
                          }))
                        }
                      >
                        +
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="merchantNote">
                備註（選填）
              </label>
              <Input id="merchantNote" name="merchantNote" className="h-11" />
            </div>
            {state.error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            <Submit
              label={selectedCount > 0 ? `送出申請（${selectedCount} 項）` : '送出申請'}
              disabled={selectedCount === 0}
            />
          </form>
        )}
      </CardContent>
    </Card>
  );
}

function Submit({
  label,
  disabled,
}: {
  label: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="min-h-[44px] w-full"
      disabled={pending || disabled}
    >
      {pending ? '送出中…' : label}
    </Button>
  );
}
