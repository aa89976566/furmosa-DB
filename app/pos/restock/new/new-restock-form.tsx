'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useSearchParams } from 'next/navigation';
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

type Mode = 'SELF_SELECT' | 'AUTO_REPLENISH';

const initial: PosRestockFormState = {};
const DRAFT_KEY = 'furmosa_pos_restock_draft_v1';

type Draft = {
  mode: Mode | null;
  qty: Record<string, number>;
  selfNote: string;
  autoNote: string;
};

function loadDraft(): Draft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

export function NewRestockForm({ products }: { products: ProductOption[] }) {
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');
  const initialMode: Mode | null =
    modeParam === 'SELF_SELECT' || modeParam === 'AUTO_REPLENISH'
      ? modeParam
      : null;

  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<Mode | null>(initialMode);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [selfNote, setSelfNote] = useState('');
  const [autoNote, setAutoNote] = useState('');

  const selfState = useFormState(submitSelfSelectRestockAction, initial);
  const autoState = useFormState(submitAutoReplenishRestockAction, initial);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      if (!initialMode && draft.mode) setMode(draft.mode);
      if (draft.qty) setQty(draft.qty);
      if (draft.selfNote) setSelfNote(draft.selfNote);
      if (draft.autoNote) setAutoNote(draft.autoNote);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once on mount
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveDraft({ mode, qty, selfNote, autoNote });
  }, [hydrated, mode, qty, selfNote, autoNote]);

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
            className="min-h-[44px] text-sm text-muted-foreground"
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
                value={autoNote}
                onChange={(e) => setAutoNote(e.target.value)}
                className="w-full rounded-xl border border-input bg-card px-3 py-3 text-base"
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
          className="min-h-[44px] text-sm text-muted-foreground"
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
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-medium leading-snug">{p.name}</p>
                      {p.stockQty !== null ? (
                        <p className="text-xs text-muted-foreground">
                          門市現有 {p.stockQty} {p.unit}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <input type="hidden" name="productId" value={p.id} />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-11 min-h-[44px] p-0"
                        aria-label={`${p.name} 減少`}
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
                        inputMode="numeric"
                        min={0}
                        className="h-11 w-14 text-center text-base"
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
                        aria-label={`${p.name} 增加`}
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
              <Input
                id="merchantNote"
                name="merchantNote"
                className="h-11"
                value={selfNote}
                onChange={(e) => setSelfNote(e.target.value)}
              />
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
      className="min-h-[48px] w-full text-base"
      disabled={pending || disabled}
    >
      {pending ? '送出中…' : label}
    </Button>
  );
}
