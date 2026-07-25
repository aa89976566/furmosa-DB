'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  cancelAppointmentAction,
  confirmAppointmentAction,
  rescheduleAppointmentAction,
  type BookingActionState,
} from '../actions';

const initial: BookingActionState = {};

export function AppointmentActions({
  appointmentId,
  status,
  slots,
}: {
  appointmentId: string;
  status: string;
  slots: { value: string; label: string }[];
}) {
  const [confirmState, confirmAction] = useFormState(
    confirmAppointmentAction,
    initial,
  );
  const [rescheduleState, rescheduleAction] = useFormState(
    rescheduleAppointmentAction,
    initial,
  );
  const [cancelState, cancelAction] = useFormState(cancelAppointmentAction, initial);

  return (
    <div className="space-y-4">
      {status === 'requested' ? (
        <form action={confirmAction}>
          <input type="hidden" name="appointmentId" value={appointmentId} />
          {confirmState.error ? (
            <p className="mb-2 text-sm text-destructive">{confirmState.error}</p>
          ) : null}
          <Submit label="確認預約" />
        </form>
      ) : null}

      <form action={rescheduleAction} className="space-y-3 rounded-xl border p-4">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <p className="text-sm font-medium">改到其他時間並確認</p>
        <p className="text-xs text-muted-foreground">
          店家可改到已滿時段（超約）。顧客端看不到已滿格。
        </p>
        <select
          name="startsAt"
          required
          className="min-h-[44px] w-full rounded-xl border bg-card px-3 text-base"
          defaultValue=""
        >
          <option value="" disabled>
            選擇新時間
          </option>
          {slots.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {rescheduleState.error ? (
          <p className="text-sm text-destructive">{rescheduleState.error}</p>
        ) : null}
        <Submit label="套用新時間" variant="outline" />
      </form>

      <form action={cancelAction}>
        <input type="hidden" name="appointmentId" value={appointmentId} />
        {cancelState.error ? (
          <p className="mb-2 text-sm text-destructive">{cancelState.error}</p>
        ) : null}
        <Submit label="取消預約" variant="ghost" />
      </form>
    </div>
  );
}

function Submit({
  label,
  variant = 'default',
}: {
  label: string;
  variant?: 'default' | 'outline' | 'ghost';
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      className="min-h-[48px] w-full text-base"
      disabled={pending}
    >
      {pending ? '處理中…' : label}
    </Button>
  );
}
