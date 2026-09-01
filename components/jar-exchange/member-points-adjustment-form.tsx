'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Minus, Plus, ShieldCheck } from 'lucide-react';
import { manualPointsAdjustment } from '@/app/(main)/jar-exchange/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MANUAL_POINT_MAX_AMOUNT,
  MANUAL_POINT_REASON_LABELS,
  type ManualPointMode,
  type ManualPointReason,
} from '@/lib/jar-exchange/manual-points';
import { formatNumber } from '@/lib/format';

type AdjustmentResult =
  | { kind: 'idle' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string; balanceAfter: number };

export function MemberPointsAdjustmentForm({
  customerId,
  customerName,
  memberNumber,
  lineDisplay,
  lineUserId,
  currentBalance,
  initialRequestId,
}: {
  customerId: string;
  customerName: string;
  memberNumber: string;
  lineDisplay: string | null;
  lineUserId: string | null;
  currentBalance: number;
  initialRequestId: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<ManualPointMode>('add');
  const [amount, setAmount] = useState('10');
  const [reason, setReason] = useState<ManualPointReason>('system_test');
  const [requestId, setRequestId] = useState(initialRequestId);
  const [previewing, setPreviewing] = useState(false);
  const [result, setResult] = useState<AdjustmentResult>({ kind: 'idle' });

  const numericAmount = Number(amount);
  const signedChange = Number.isInteger(numericAmount)
    ? mode === 'add'
      ? numericAmount
      : -numericAmount
    : 0;
  const balanceAfter = currentBalance + signedChange;
  const amountIsValid =
    Number.isInteger(numericAmount) &&
    numericAmount >= 1 &&
    numericAmount <= MANUAL_POINT_MAX_AMOUNT &&
    balanceAfter >= 0;
  const lineLabel = useMemo(() => {
    if (lineDisplay) return lineDisplay;
    if (!lineUserId) return '尚未綁定 LINE';
    return `${lineUserId.slice(0, 8)}…${lineUserId.slice(-4)}`;
  }, [lineDisplay, lineUserId]);

  function resetPreview() {
    setPreviewing(false);
    setResult({ kind: 'idle' });
  }

  function submitAdjustment() {
    const form = formRef.current;
    if (!form || !form.reportValidity() || !amountIsValid) return;
    const payload = new FormData(form);
    startTransition(async () => {
      try {
        const response = await manualPointsAdjustment(payload);
        if (!response.ok) {
          setResult({ kind: 'error', message: response.error });
          return;
        }
        const verb = response.pointsChange > 0 ? '增加' : '扣除';
        setResult({
          kind: 'success',
          balanceAfter: response.balanceAfter,
          message: response.duplicated
            ? '這次操作先前已完成，系統未重複調整。'
            : `已為 ${customerName}${verb} ${formatNumber(Math.abs(response.pointsChange))} 點。`,
        });
        setPreviewing(false);
        setRequestId(crypto.randomUUID());
        router.refresh();
      } catch {
        setResult({ kind: 'error', message: '連線中斷，請重新整理帳本確認後再試' });
      }
    });
  }

  return (
    <form
      ref={formRef}
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        setResult({ kind: 'idle' });
        setPreviewing(true);
      }}
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="mode" value={mode} />

      <section className="rounded-2xl border-2 border-foreground bg-card p-4 shadow-card sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          本次調整會員
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-navy">{customerName}</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{memberNumber}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              LINE：{lineLabel}
              {lineUserId ? '（已綁定）' : ''}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs text-muted-foreground">目前餘額</p>
            <p className="text-3xl font-semibold tabular-nums text-navy">
              {formatNumber(currentBalance)}
              <span className="ml-1 text-sm font-normal">點</span>
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-2xl border-2 border-foreground bg-card p-4 shadow-card sm:p-5">
        <div>
          <h2 className="font-semibold text-navy">1. 選擇調整方式</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-pressed={mode === 'add'}
              onClick={() => {
                setMode('add');
                resetPreview();
              }}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-4 font-semibold transition-colors ${
                mode === 'add'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card hover:border-foreground'
              }`}
            >
              <Plus className="h-4 w-4" /> 增加點數
            </button>
            <button
              type="button"
              aria-pressed={mode === 'deduct'}
              onClick={() => {
                setMode('deduct');
                resetPreview();
              }}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 px-4 font-semibold transition-colors ${
                mode === 'deduct'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-card hover:border-foreground'
              }`}
            >
              <Minus className="h-4 w-4" /> 扣除點數
            </button>
          </div>
        </div>

        <div>
          <label htmlFor="point-amount" className="text-sm font-semibold text-navy">
            2. 輸入點數
          </label>
          <Input
            id="point-amount"
            name="amount"
            type="number"
            min={1}
            max={MANUAL_POINT_MAX_AMOUNT}
            step={1}
            required
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              resetPreview();
            }}
            className="mt-2 max-w-xs text-lg tabular-nums"
          />
          {!amountIsValid ? (
            <p className="mt-2 text-sm text-destructive">
              {balanceAfter < 0
                ? '扣除後餘額不可小於 0'
                : `請輸入 1～${MANUAL_POINT_MAX_AMOUNT} 的整數`}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="point-reason" className="text-sm font-semibold text-navy">
            3. 選擇原因（必填）
          </label>
          <select
            id="point-reason"
            name="reason"
            required
            value={reason}
            onChange={(event) => {
              setReason(event.target.value as ManualPointReason);
              resetPreview();
            }}
            className="mt-2 h-10 w-full rounded-xl border-2 border-foreground bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Object.entries(MANUAL_POINT_REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="point-detail" className="text-sm font-semibold text-navy">
            4. 補充說明或參考編號（選填）
          </label>
          <textarea
            id="point-detail"
            name="detail"
            maxLength={120}
            rows={3}
            onChange={resetPreview}
            placeholder="例如：LINE 綁定測試、客服案件編號"
            className="mt-2 w-full resize-y rounded-xl border-2 border-foreground bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {!previewing ? (
          <Button type="submit" className="w-full sm:w-auto" disabled={!amountIsValid}>
            預覽調整結果
          </Button>
        ) : (
          <div className="rounded-2xl border-2 border-foreground bg-muted/30 p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">目前</p>
                <p className="mt-1 font-semibold tabular-nums">{formatNumber(currentBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">變動</p>
                <p className="mt-1 font-semibold tabular-nums">
                  {signedChange > 0 ? '+' : ''}
                  {formatNumber(signedChange)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">調整後</p>
                <p className="mt-1 font-semibold tabular-nums">{formatNumber(balanceAfter)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                原因：{MANUAL_POINT_REASON_LABELS[reason]}
                。此操作只調整點數帳本，不代表已完成換罐或核銷優惠券。
              </span>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setPreviewing(false)}>
                返回修改
              </Button>
              <Button type="button" disabled={pending || !amountIsValid} onClick={submitAdjustment}>
                {pending
                  ? '處理中…'
                  : `確認為 ${customerName}${mode === 'add' ? '增加' : '扣除'} ${formatNumber(numericAmount)} 點`}
              </Button>
            </div>
          </div>
        )}

        <div aria-live="polite">
          {result.kind === 'error' ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
            >
              {result.message}
            </p>
          ) : null}
          {result.kind === 'success' ? (
            <div className="flex items-start gap-2 rounded-xl border border-success/40 bg-success/5 p-3 text-sm text-success">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                {result.message} 最新餘額為 {formatNumber(result.balanceAfter)} 點。
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </form>
  );
}
