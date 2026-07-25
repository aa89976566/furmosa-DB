'use client';

import { useEffect, useState } from 'react';
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
  liffId,
}: {
  merchantId: string;
  dateStr: string;
  slots: { value: string; label: string }[];
  services: { id: string; name: string }[];
  /** 可選：用既有 LIFF 取得 idToken，綁定 LINE 以收通知 */
  liffId?: string | null;
}) {
  const router = useRouter();
  const [state, action] = useFormState(publicBookAction, initial);
  const defaultService = services[0];
  const [lineIdToken, setLineIdToken] = useState('');
  const [lineStatus, setLineStatus] = useState<'idle' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!liffId) return;
    let cancelled = false;
    (async () => {
      try {
        const liff = (await import('@line/liff')).default;
        await liff.init({ liffId });
        if (cancelled) return;
        if (!liff.isInClient() && !liff.isLoggedIn()) {
          // 外部瀏覽器不強制登入；使用者可點按鈕
          return;
        }
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const token = liff.getIDToken();
        if (token) {
          setLineIdToken(token);
          setLineStatus('ready');
        }
      } catch {
        if (!cancelled) setLineStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liffId]);

  async function connectLine() {
    if (!liffId) return;
    try {
      const liff = (await import('@line/liff')).default;
      await liff.init({ liffId });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      const token = liff.getIDToken();
      if (token) {
        setLineIdToken(token);
        setLineStatus('ready');
      }
    } catch {
      setLineStatus('error');
    }
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="merchantId" value={merchantId} />
      <input type="hidden" name="lineIdToken" value={lineIdToken} />

      {liffId ? (
        <div className="rounded-xl border border-dashed px-3 py-3 text-sm">
          {lineStatus === 'ready' ? (
            <p className="text-primary">已連接 LINE，送出後會收到預約通知。</p>
          ) : (
            <>
              <p className="mb-2 text-muted-foreground">
                建議連接 LINE，才能收到「已收到申請／已確認／行前提醒」。
              </p>
              <Button type="button" variant="outline" className="w-full" onClick={connectLine}>
                用 LINE 收取通知
              </Button>
              {lineStatus === 'error' ? (
                <p className="mt-2 text-xs text-destructive">
                  LINE 連線失敗，仍可送出預約（若電話已是會員也可能收到通知）。
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          若你的電話已綁定匠寵 LINE 會員，送出後會自動收到通知。
        </p>
      )}

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
