'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  saveNotificationSettingsAction,
  type NotificationSettingsActionState,
} from './actions';

const initialState: NotificationSettingsActionState = {};

export function NotificationSettingsForm(props: {
  enabled: boolean;
  lineUserId: string;
}) {
  const [state, action] = useFormState(saveNotificationSettingsAction, initialState);

  return (
    <form action={action} className="space-y-4">
      <div>
        <p className="font-medium text-navy">店家通知</p>
        <p className="mt-1 text-xs text-muted-foreground">
          POS 鈴鐺會自動顯示補貨進度；綁定 LINE 後，也會在補貨寄出時通知。
        </p>
      </div>
      <label className="flex min-h-[44px] items-center gap-3">
        <input
          name="lineNotificationEnabled"
          type="checkbox"
          defaultChecked={props.enabled}
          className="h-5 w-5 rounded border-input"
        />
        <span>啟用店家 LINE 通知</span>
      </label>
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="bookingNotifyLineUserId">
          店家 LINE User ID
        </label>
        <Input
          id="bookingNotifyLineUserId"
          name="bookingNotifyLineUserId"
          defaultValue={props.lineUserId}
          placeholder="U 開頭的 LINE User ID"
          className="h-11"
          autoCapitalize="none"
          autoCorrect="off"
        />
        <p className="text-xs text-muted-foreground">
          尚未綁定時，POS 鈴鐺仍會正常通知，不會影響補貨流程。
        </p>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.ok ? <p className="text-sm text-primary">通知設定已儲存。</p> : null}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="min-h-[48px] w-full" disabled={pending}>
      {pending ? '儲存中…' : '儲存通知設定'}
    </Button>
  );
}
