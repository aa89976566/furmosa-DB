'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendJarReturnReminder20260828 } from '@/app/(main)/jar-exchange/actions';

type Result = { sent: number; skipped: number; failed: number };

/**
 * 一次性行政動作面板：2026-08-28 提醒換罐會員把空罐帶回合作店。
 * 僅供本次使用，人數不符 6 位時後端會中止不送出。
 */
export function JarReturnReminder20260828Panel() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!confirm('確定要發送 6 位會員的換罐提醒訊息嗎？此動作無法復原。')) return;

    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await sendJarReturnReminder20260828();
      if (res.ok) {
        setResult({ sent: res.sent, skipped: res.skipped, failed: res.failed });
      } else {
        setError(res.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '發送失敗，請稍後再試');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-card">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => void handleClick()}
      >
        {pending ? '發送中…' : '發送 6 位會員'}
      </Button>
      {result ? (
        <p className="text-sm text-success">
          已送出 {result.sent}／略過 {result.skipped}／失敗 {result.failed}
        </p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
