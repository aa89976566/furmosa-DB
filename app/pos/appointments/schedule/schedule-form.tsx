'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  saveBookingScheduleAction,
  type BookingActionState,
} from '../actions';

const initial: BookingActionState = {};

export function ScheduleForm(props: {
  openTime: string;
  closeTime: string;
  slotMinutes: number;
  capacityPerSlot: number;
  weekdays: string;
  bookingNotifyLineUserId: string;
}) {
  const [state, action] = useFormState(saveBookingScheduleAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="openTime">
            開始
          </label>
          <Input
            id="openTime"
            name="openTime"
            defaultValue={props.openTime}
            placeholder="09:00"
            className="h-11"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="closeTime">
            結束
          </label>
          <Input
            id="closeTime"
            name="closeTime"
            defaultValue={props.closeTime}
            placeholder="18:00"
            className="h-11"
            required
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="slotMinutes">
          每格分鐘
        </label>
        <Input
          id="slotMinutes"
          name="slotMinutes"
          type="number"
          min={15}
          step={15}
          defaultValue={props.slotMinutes}
          className="h-11"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="capacityPerSlot">
          每格可接幾組（顧客滿額）
        </label>
        <Input
          id="capacityPerSlot"
          name="capacityPerSlot"
          type="number"
          min={1}
          defaultValue={props.capacityPerSlot}
          className="h-11"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="weekdays">
          營業星期（0=日…6=六）
        </label>
        <Input
          id="weekdays"
          name="weekdays"
          defaultValue={props.weekdays}
          className="h-11"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="bookingNotifyLineUserId">
          新預約 LINE 通知（選填）
        </label>
        <Input
          id="bookingNotifyLineUserId"
          name="bookingNotifyLineUserId"
          defaultValue={props.bookingNotifyLineUserId}
          placeholder="U 開頭的 LINE User ID"
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          填了才會在客人送出時收到「有新預約」。可向 Furmosa 索取店家綁定用 ID。
        </p>
      </div>
      {state.error ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-primary">已儲存。公開預約已開啟。</p>
      ) : null}
      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="min-h-[48px] w-full" disabled={pending}>
      {pending ? '儲存中…' : '儲存班表'}
    </Button>
  );
}
