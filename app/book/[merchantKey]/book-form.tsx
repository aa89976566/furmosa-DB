'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { publicBookAction, type PublicBookState } from '../actions';

const initial: PublicBookState = {};

export function PublicBookForm({
  merchantId,
  dateStr,
  slots,
  services,
}: {
  merchantId: string;
  dateStr: string;
  slots: { value: string; label: string }[];
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action] = useFormState(publicBookAction, initial);
  const defaultService = services[0];

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="merchantId" value={merchantId} />
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="date">
          日期
        </label>
        <Input
          id="date"
          type="date"
          className="h-11"
          defaultValue={dateStr}
          onChange={(e) => {
            const path = window.location.pathname;
            router.push(`${path}?date=${e.target.value}`);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="startsAt">
          時間
        </label>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">這天沒有可預約時段。</p>
        ) : (
          <select
            id="startsAt"
            name="startsAt"
            required
            className="min-h-[48px] w-full rounded-xl border bg-card px-3 text-base"
            defaultValue=""
          >
            <option value="" disabled>
              選擇時間
            </option>
            {slots.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="serviceProductId">
          服務
        </label>
        <select
          id="serviceProductId"
          name="serviceProductId"
          className="min-h-[48px] w-full rounded-xl border bg-card px-3 text-base"
          defaultValue={defaultService?.id ?? ''}
        >
          {services.map((s) => (
            <option key={s.name} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="hidden"
          name="serviceName"
          value={defaultService?.name ?? '美容'}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="customerName">
          你的姓名
        </label>
        <Input id="customerName" name="customerName" required className="h-11" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="customerPhone">
          電話
        </label>
        <Input id="customerPhone" name="customerPhone" required className="h-11" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="petName">
          寵物名（選填）
        </label>
        <Input id="petName" name="petName" className="h-11" />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="customerNote">
          備註（選填）
        </label>
        <textarea
          id="customerNote"
          name="customerNote"
          rows={3}
          className="w-full rounded-xl border bg-card px-3 py-3 text-base"
          placeholder="例如：第一次、體型較大、皮膚敏感…"
        />
      </div>
      {state.error ? (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Submit disabled={slots.length === 0} />
    </form>
  );
}

function Submit({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="min-h-[48px] w-full text-base"
      disabled={pending || disabled}
    >
      {pending ? '送出中…' : '送出預約'}
    </Button>
  );
}
