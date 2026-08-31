'use client';

import { useState } from 'react';
import { createApprovedFiveIdentityDecisions } from '@/app/(main)/jar-exchange/stores/actions';
import {
  APPROVED_PARTNER_STORE_COUNT,
  APPROVED_PARTNER_STORE_PAIRS,
} from '@/lib/jar-exchange/partner-store-approved-five';
import { Button } from '@/components/ui/button';

export function ApprovedFiveRolloutPanel({ activeCount }: { activeCount: number }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const complete = activeCount === APPROVED_PARTNER_STORE_COUNT;

  return (
    <div className="px-5 py-4">
      <p className="text-sm text-navy">五家已鎖定門市正式確認</p>
      <p className="mt-1 text-sm text-muted-foreground">
        五筆會在同一個資料庫交易完成；任一筆不符合，整批都不寫入。
      </p>
      <ul className="mt-3 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
        {APPROVED_PARTNER_STORE_PAIRS.map((pair) => (
          <li key={pair.merchantId}>
            {pair.label} · {pair.merchantId} ↔ {pair.legacySlug}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={pending || complete || activeCount > 0}
          onClick={async () => {
            setPending(true);
            setMessage(null);
            const result = await createApprovedFiveIdentityDecisions();
            setPending(false);
            setMessage(result.ok ? '五家門市已完成正式確認。' : result.error);
          }}
        >
          {complete ? '五家已完成' : '一次確認五家門市'}
        </Button>
        <p className="text-sm text-muted-foreground">
          目前 {activeCount}／{APPROVED_PARTNER_STORE_COUNT} 家
        </p>
      </div>
      {activeCount > 0 && !complete ? (
        <p className="mt-3 text-sm text-destructive">已有部分有效資料，已停止批次操作。</p>
      ) : null}
      {message ? <p className="mt-3 text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
