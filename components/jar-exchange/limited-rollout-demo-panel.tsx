'use client';

import { useState } from 'react';
import {
  createDemoIdentityDecision,
  revokeDemoIdentityDecision,
} from '@/app/(main)/jar-exchange/stores/actions';
import { Button } from '@/components/ui/button';

export function LimitedRolloutDemoPanel({
  activeDemoId,
}: {
  activeDemoId: string | null;
}) {
  const [reason, setReason] = useState('第三層驗證後撤銷 MER-DEMO');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="px-5 py-4">
      <p className="text-sm text-navy">MER-DEMO 小範圍驗證</p>
      <p className="mt-1 text-sm text-muted-foreground">
        只允許指定 HQ 帳號寫入 MER-DEMO。五家真店不能寫入。驗證後請立刻關閉寫入開關。
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        {activeDemoId ? (
          <>
            <label className="block min-w-0 flex-1 text-sm">
              <span className="text-muted-foreground">撤銷原因</span>
              <input
                className="mt-1 w-full rounded-xl border border-border/80 bg-card px-3 py-2"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={pending || !reason.trim()}
              onClick={async () => {
                setPending(true);
                setMessage(null);
                const result = await revokeDemoIdentityDecision(activeDemoId, reason);
                setPending(false);
                setMessage(result.ok ? '已撤銷 MER-DEMO，原紀錄仍在。' : result.error);
              }}
            >
              撤銷 MER-DEMO
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setMessage(null);
              const result = await createDemoIdentityDecision();
              setPending(false);
              setMessage(result.ok ? '已建立 MER-DEMO 示範判定。' : result.error);
            }}
          >
            建立 MER-DEMO 示範判定
          </Button>
        )}
      </div>
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
