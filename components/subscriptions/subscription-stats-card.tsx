'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { subscriptionPaymentTypeLabel } from '@/lib/labels';
import { updateSubscriptionStats } from '@/app/(main)/subscriptions/[id]/actions';
import { Check, Pencil, X } from 'lucide-react';

const PAYMENT_TYPES = ['full', 'monthly', 'other'] as const;

export type SubscriptionStatsData = {
  subscriptionId: string;
  statusActive: boolean;
  startInput: string;
  endInput: string;
  nextInput: string;
  startLabel: string;
  endLabel: string;
  nextLabel: string;
  nextNote: string;
  progressLabel: string;
  paymentType: string;
  paymentNote: string;
};

export function SubscriptionStatsCard({ data }: { data: SubscriptionStatsData }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    const paymentLabel =
      subscriptionPaymentTypeLabel[data.paymentType] ?? data.paymentType ?? '月付';
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="開始日" value={data.startLabel} />
          <Stat label="到期日" value={data.endLabel} />
          <Stat label="下次出貨" value={data.nextLabel} note={data.nextNote} />
          <Stat label="出貨進度" value={data.progressLabel} note="已寄 / 全部排程" />
          <Stat label="付款方式" value={paymentLabel} />
          <Stat
            label="付款說明"
            value={
              data.paymentType === 'other' && data.paymentNote.trim() ? data.paymentNote : '—'
            }
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="mr-1 h-4 w-4" />
          編輯統計
        </Button>
      </div>
    );
  }

  return <StatsEditForm data={data} onDone={() => setEditing(false)} />;
}

function StatsEditForm({ data, onDone }: { data: SubscriptionStatsData; onDone: () => void }) {
  const [unlimited, setUnlimited] = useState(data.endInput === '');
  const [paymentType, setPaymentType] = useState(
    PAYMENT_TYPES.includes(data.paymentType as (typeof PAYMENT_TYPES)[number])
      ? data.paymentType
      : 'monthly',
  );

  return (
    <form
      action={async (fd) => {
        await updateSubscriptionStats(fd);
        onDone();
      }}
      className="space-y-3"
    >
      <input type="hidden" name="subscriptionId" value={data.subscriptionId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="開始日">
          <input type="date" name="startDate" required defaultValue={data.startInput} className={inputCls} />
        </Field>
        <Field label="下次出貨">
          <input type="date" name="nextShipmentDate" defaultValue={data.nextInput} className={inputCls} />
        </Field>
        <div className="space-y-1 sm:col-span-2">
          <span className="text-xs font-medium text-muted-foreground">到期日</span>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="date"
              name="endDate"
              defaultValue={data.endInput}
              disabled={unlimited}
              className={`${inputCls} max-w-[11rem] disabled:opacity-50`}
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="unlimitedEnd"
                checked={unlimited}
                onChange={(e) => setUnlimited(e.target.checked)}
                className="rounded border-input"
              />
              無限期
            </label>
          </div>
        </div>
        <Field label="付款方式">
          <select
            name="paymentType"
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            className={inputCls}
          >
            {PAYMENT_TYPES.map((k) => (
              <option key={k} value={k}>
                {subscriptionPaymentTypeLabel[k]}
              </option>
            ))}
          </select>
        </Field>
        {paymentType === 'other' && (
          <Field label="付款說明">
            <input
              name="paymentNote"
              defaultValue={data.paymentNote}
              placeholder="例：季付轉帳後五碼…"
              className={inputCls}
            />
          </Field>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        出貨進度由實際出貨單自動計算，無法手動修改。
      </p>

      <div className="flex justify-end gap-2 border-t pt-3">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          <X className="mr-1 h-4 w-4" />
          取消
        </Button>
        <SaveButton />
      </div>
    </form>
  );
}

const inputCls =
  'block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-base font-semibold">{value}</div>
      {note && <div className="text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Check className="mr-1 h-4 w-4" />
      {pending ? '儲存中…' : '儲存統計'}
    </Button>
  );
}
