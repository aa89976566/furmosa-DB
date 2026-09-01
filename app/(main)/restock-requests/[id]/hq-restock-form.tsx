'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  approveRestockRequestAction,
  rejectRestockRequestAction,
  saveRestockRequestHqAction,
  type HqRestockActionState,
} from '../actions';

type ItemRow = {
  productId: string;
  productName: string;
  requestedQuantity: number | null;
  approvedQuantity: number;
};

type CatalogItem = { id: string; name: string };

const initial: HqRestockActionState = {};

export function HqRestockDetailForm({
  requestId,
  locked,
  hqNote,
  expectedArrivalDate,
  items: initialItems,
  catalog,
}: {
  requestId: string;
  locked: boolean;
  hqNote: string;
  expectedArrivalDate: string;
  items: ItemRow[];
  catalog: CatalogItem[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [note, setNote] = useState(hqNote);
  const [arrival, setArrival] = useState(expectedArrivalDate);
  const [addProductId, setAddProductId] = useState('');

  const [saveState, saveAction] = useFormState(saveRestockRequestHqAction, initial);
  const [approveState, approveAction] = useFormState(
    approveRestockRequestAction,
    initial,
  );
  const [rejectState, rejectAction] = useFormState(
    rejectRestockRequestAction,
    initial,
  );

  const availableToAdd = useMemo(
    () => catalog.filter((c) => !items.some((i) => i.productId === c.id)),
    [catalog, items],
  );

  useEffect(() => {
    if (approveState.redirectTo) {
      router.push(approveState.redirectTo);
    }
  }, [approveState.redirectTo, router]);

  function addItem() {
    const p = catalog.find((c) => c.id === addProductId);
    if (!p) return;
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        requestedQuantity: null,
        approvedQuantity: 1,
      },
    ]);
    setAddProductId('');
  }

  const error = saveState.error || approveState.error || rejectState.error;
  const ok = saveState.ok || approveState.ok || rejectState.ok;

  const hidden = (
    <>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="hqNote" value={note} />
      <input type="hidden" name="expectedArrivalDate" value={arrival} />
      {items.map((it) => (
        <span key={it.productId}>
          <input type="hidden" name="productId" value={it.productId} />
          <input
            type="hidden"
            name="approvedQuantity"
            value={String(it.approvedQuantity)}
          />
          <input
            type="hidden"
            name="requestedQuantity"
            value={it.requestedQuantity == null ? '' : String(it.requestedQuantity)}
          />
        </span>
      ))}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-3 text-sm font-medium">品項與核准數量</p>
        {items.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">
            尚無品項（「請幫我配」請先新增商品）
          </p>
        ) : (
          <ul className="mb-3 space-y-2">
            {items.map((it, idx) => (
              <li
                key={it.productId}
                className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm"
              >
                <span className="min-w-[12rem] flex-1 font-medium">
                  {it.productName}
                </span>
                <span className="text-xs text-muted-foreground">
                  申請 {it.requestedQuantity ?? '—'}
                </span>
                <Input
                  type="number"
                  min={0}
                  className="h-10 w-24"
                  disabled={locked}
                  value={it.approvedQuantity}
                  onChange={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0);
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, approvedQuantity: v } : row,
                      ),
                    );
                  }}
                />
                {!locked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="min-h-[40px]"
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== idx))
                    }
                  >
                    刪除
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {!locked && availableToAdd.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <select
              className="h-10 min-w-[12rem] flex-1 rounded-xl border px-2 text-sm"
              value={addProductId}
              onChange={(e) => setAddProductId(e.target.value)}
            >
              <option value="">新增換罐商品…</option>
              {availableToAdd.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px]"
              onClick={addItem}
              disabled={!addProductId}
            >
              加入
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="expectedArrivalDate">
            預計到貨日
          </label>
          <Input
            id="expectedArrivalDate"
            type="date"
            className="h-11"
            disabled={locked}
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
            onInput={(e) => setArrival(e.currentTarget.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="hqNote">
            公司備註
          </label>
          <textarea
            id="hqNote"
            disabled={locked}
            rows={3}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-secondary px-3 py-2 text-sm">{ok}</p>
      ) : null}

      {!locked ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action={saveAction} className="flex-1">
            {hidden}
            <SubmitButton label="儲存調整" variant="outline" />
          </form>
          <form action={approveAction} className="flex-1">
            {hidden}
            <SubmitButton label="核准並建立出貨單" />
          </form>
          <form action={rejectAction} className="flex-1">
            <input type="hidden" name="requestId" value={requestId} />
            <input type="hidden" name="hqNote" value={note} />
            <SubmitButton label="拒絕" variant="destructive" />
          </form>
        </div>
      ) : null}
    </div>
  );
}

function SubmitButton({
  label,
  variant = 'default',
}: {
  label: string;
  variant?: 'default' | 'outline' | 'destructive';
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      className="min-h-[44px] w-full"
      disabled={pending}
    >
      {pending ? '處理中…' : label}
    </Button>
  );
}
