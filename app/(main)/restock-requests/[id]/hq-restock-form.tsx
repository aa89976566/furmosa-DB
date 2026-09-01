'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  approveRestockRequestAction,
  rejectRestockRequestAction,
  saveRestockRequestHqAction,
  type HqRestockActionState,
} from '../actions';

const CONFLICT_MESSAGE = '這張申請已被其他人更新，請重新載入';

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
  detailHref,
  viewMode,
  allowCatalogAdds,
  hqNote,
  expectedArrivalDate,
  items: initialItems,
  catalog,
}: {
  requestId: string;
  detailHref: string;
  viewMode: 'review' | 'convert';
  allowCatalogAdds: boolean;
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
  const [approveStep, setApproveStep] = useState<'edit' | 'confirm'>('edit');
  const [rejectStep, setRejectStep] = useState<'edit' | 'confirm'>('edit');

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
  const conflict = saveState.conflict || approveState.conflict || rejectState.conflict;
  const ok = saveState.ok || approveState.ok || rejectState.ok;
  const canEditItems = viewMode === 'review';

  return (
    <form action={saveAction} className="space-y-4">
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
        </span>
      ))}

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
                {canEditItems ? (
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="h-10 w-24"
                    value={String(it.approvedQuantity)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (raw === '') {
                        setItems((prev) =>
                          prev.map((row, i) =>
                            i === idx ? { ...row, approvedQuantity: 0 } : row,
                          ),
                        );
                        return;
                      }
                      if (!/^\d+$/.test(raw)) return;
                      setItems((prev) =>
                        prev.map((row, i) =>
                          i === idx ? { ...row, approvedQuantity: Number(raw) } : row,
                        ),
                      );
                    }}
                    aria-label={`${it.productName} 核准數量`}
                  />
                ) : (
                  <span className="text-sm font-medium">核准 {it.approvedQuantity}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEditItems && allowCatalogAdds && availableToAdd.length > 0 ? (
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
            disabled={!canEditItems && viewMode !== 'convert'}
            value={arrival}
            onChange={(e) => setArrival(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="hqNote">
            審核備註{viewMode === 'review' ? '（拒絕時必填）' : ''}
          </label>
          <textarea
            id="hqNote"
            rows={3}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      {error ? (
        <div
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <p>{conflict ? CONFLICT_MESSAGE : error}</p>
          {conflict ? (
            <p className="mt-2">
              <Link href={detailHref} className="underline">
                重新載入最新狀態
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}
      {ok ? (
        <p className="rounded-md bg-secondary px-3 py-2 text-sm">{ok}</p>
      ) : null}

      {approveStep === 'confirm' ? (
        <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <p className="font-medium">即將核准並建立出貨單</p>
          <ul className="space-y-1">
            {items.map((it) => (
              <li key={it.productId}>
                {it.productName}：申請 {it.requestedQuantity ?? '—'} → 核准 {it.approvedQuantity}
              </li>
            ))}
          </ul>
          <p>預計到貨：{arrival || '尚未填寫'}</p>
          <p>備註：{note.trim() || '無'}</p>
        </div>
      ) : null}

      {rejectStep === 'confirm' ? (
        <div className="space-y-2 rounded-xl border p-4 text-sm">
          <p className="font-medium">即將拒絕這張申請</p>
          <p>原因：{note.trim() || '尚未填寫'}</p>
        </div>
      ) : null}

      <ReviewActions
        viewMode={viewMode}
        approveStep={approveStep}
        rejectStep={rejectStep}
        onApproveStep={setApproveStep}
        onRejectStep={setRejectStep}
        saveAction={saveAction}
        approveAction={approveAction}
        rejectAction={rejectAction}
      />
    </form>
  );
}

function ReviewActions({
  viewMode,
  approveStep,
  rejectStep,
  onApproveStep,
  onRejectStep,
  saveAction,
  approveAction,
  rejectAction,
}: {
  viewMode: 'review' | 'convert';
  approveStep: 'edit' | 'confirm';
  rejectStep: 'edit' | 'confirm';
  onApproveStep: (step: 'edit' | 'confirm') => void;
  onRejectStep: (step: 'edit' | 'confirm') => void;
  saveAction: (formData: FormData) => void;
  approveAction: (formData: FormData) => void;
  rejectAction: (formData: FormData) => void;
}) {
  const { pending } = useFormStatus();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {viewMode === 'review' ? (
          <Button
            type="submit"
            formAction={saveAction}
            variant="outline"
            className="min-h-[44px] sm:flex-1"
            disabled={pending}
          >
            {pending ? '處理中…' : '儲存調整'}
          </Button>
        ) : null}

        {approveStep === 'edit' ? (
          <Button
            type="button"
            className="min-h-[44px] sm:flex-[1.4]"
            disabled={pending}
            onClick={() => {
              onRejectStep('edit');
              onApproveStep('confirm');
            }}
          >
            確認核准申請
          </Button>
        ) : (
          <Button
            type="submit"
            formAction={approveAction}
            className="min-h-[44px] sm:flex-[1.4]"
            disabled={pending}
          >
            {pending ? '處理中…' : '送出核准並建立出貨單'}
          </Button>
        )}
      </div>

      {viewMode === 'review' ? (
        rejectStep === 'edit' ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-[44px] self-start text-muted-foreground"
            disabled={pending}
            onClick={() => {
              onApproveStep('edit');
              onRejectStep('confirm');
            }}
          >
            拒絕申請
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              formAction={rejectAction}
              variant="outline"
              className="min-h-[44px]"
              disabled={pending}
            >
              {pending ? '處理中…' : '確認拒絕'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-[44px]"
              disabled={pending}
              onClick={() => onRejectStep('edit')}
            >
              取消
            </Button>
          </div>
        )
      ) : null}

      {approveStep === 'confirm' ? (
        <Button
          type="button"
          variant="ghost"
          className="min-h-[44px] self-start"
          disabled={pending}
          onClick={() => onApproveStep('edit')}
        >
          返回修改
        </Button>
      ) : null}
    </div>
  );
}
