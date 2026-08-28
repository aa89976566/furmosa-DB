'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendJarReturnReminder20260828 } from '@/app/(main)/jar-exchange/actions';

type Result = { sent: number; skipped: number; failed: number };
type Candidate = { id: string; name: string };

/**
 * 一次性行政動作面板：2026-08-28 提醒換罐會員把空罐帶回合作店。
 * 僅供本次使用；管理員需明確選取 6 位，後端會再次檢查資格。
 */
export function JarReturnReminder20260828Panel({ candidates }: { candidates: Candidate[] }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(
    candidates.length === 6 ? candidates.map((candidate) => candidate.id) : [],
  );

  const handleClick = async () => {
    if (selectedIds.length !== 6) {
      setError(`請剛好勾選 6 位會員，目前選擇 ${selectedIds.length} 位`);
      return;
    }
    const selectedNames = candidates
      .filter((candidate) => selectedIds.includes(candidate.id))
      .map((candidate) => candidate.name)
      .join('、');
    if (!confirm(`確定要發送換罐提醒給以下 6 位會員？\n${selectedNames}\n\n此動作無法復原。`)) return;

    setPending(true);
    setError(null);
    setResult(null);
    try {
      const res = await sendJarReturnReminder20260828(selectedIds);
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
    <div className="mb-4 space-y-3 rounded-2xl border border-border/60 bg-card px-4 py-3 shadow-card">
      <div>
        <p className="text-sm font-medium">選擇本次換罐提醒收件人</p>
        <p className="mt-1 text-xs text-muted-foreground">
          系統找到 {candidates.length} 位符合條件的 LINE 會員，請剛好勾選 6 位。
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {candidates.map((candidate) => {
          const checked = selectedIds.includes(candidate.id);
          return (
            <label
              key={candidate.id}
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={checked}
                disabled={pending}
                onChange={(event) => {
                  setError(null);
                  setSelectedIds((current) =>
                    event.target.checked
                      ? [...current, candidate.id]
                      : current.filter((id) => id !== candidate.id),
                  );
                }}
              />
              {candidate.name}
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || selectedIds.length !== 6}
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
    </div>
  );
}
