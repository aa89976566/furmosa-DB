'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createManualAppointmentAction,
  type BookingActionState,
} from '../actions';

const initial: BookingActionState = {};

export function ManualAppointmentForm({
  dateStr,
  slots,
  services,
}: {
  dateStr: string;
  slots: { value: string; label: string }[];
  services: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action] = useFormState(createManualAppointmentAction, initial);

  return (
    <form action={action} className="space-y-4">
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
            router.push(`/pos/appointments/new?date=${e.target.value}`);
          }}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="startsAt">
          時間
        </label>
        <select
          id="startsAt"
          name="startsAt"
          required
          className="min-h-[44px] w-full rounded-xl border bg-card px-3 text-base"
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
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="customerName">
          客人姓名
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
        <label className="text-sm font-medium" htmlFor="serviceProductId">
          服務
        </label>
        <select
          id="serviceProductId"
          name="serviceProductId"
          className="min-h-[44px] w-full rounded-xl border bg-card px-3 text-base"
          defaultValue={services[0]?.id ?? ''}
        >
          {services.map((s) => (
            <option key={s.name} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input type="hidden" name="serviceName" value={services[0]?.name ?? '美容'} />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="customerNote">
          備註（選填）
        </label>
        <Input id="customerNote" name="customerNote" className="h-11" />
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="min-h-[48px] w-full" disabled={pending}>
      {pending ? '新增中…' : '新增並確認'}
    </Button>
  );
}
