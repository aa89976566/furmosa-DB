'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  saveNotificationSettingsAction,
  unlinkMerchantLineAction,
  type NotificationSettingsActionState,
} from './actions';

const initialState: NotificationSettingsActionState = {};

export function NotificationSettingsForm(props: {
  enabled: boolean;
  lineUserId: string;
  lineBindUrl: string | null;
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
      <input type="hidden" name="bookingNotifyLineUserId" value={props.lineUserId} />
      {props.lineUserId ? (
        <div className="rounded-xl border bg-muted/20 p-4">
          <p className="font-medium text-navy">LINE 已綁定</p>
          <p className="mt-1 text-xs text-muted-foreground">出貨時會同步通知這個 LINE 帳號。</p>
          <button
            type="submit"
            formAction={unlinkMerchantLineAction}
            className="mt-3 min-h-[44px] text-sm text-destructive underline underline-offset-4"
          >
            解除 LINE 綁定
          </button>
        </div>
      ) : props.lineBindUrl ? (
        <a
          href={props.lineBindUrl}
          className="flex min-h-[48px] w-full items-center justify-center rounded-md bg-[#06C755] px-4 font-medium text-white"
        >
          綁定 LINE 接收通知
        </a>
      ) : (
        <p className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          LINE 綁定服務尚未設定，POS 鈴鐺仍會正常通知。
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        尚未綁定時，POS 鈴鐺仍會正常通知，不會影響補貨流程。
      </p>
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
