'use client';

import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { COPY, FIXTURE_LABELS, POS_STORE_LABEL, POS_TASK_SUBTITLE, POS_TASK_TITLE } from '@/lib/grooming-voucher-preview/copy';
import { listFixtureKeys } from '@/lib/grooming-voucher-preview/fixtures';
import {
  closeReview,
  createPosSession,
  currentVoucher,
  finishRedeem,
  goHome,
  lookupVoucher,
  openRedeemTask,
  openReview,
  setCancelReason,
  setCodeInput,
  setServiceConfirmed,
  setServiceTotalInput,
  simulateScan,
  startRedeem,
  submitCancelRequest,
  switchFixture,
} from '@/lib/grooming-voucher-preview/pos-logic';
import type { FixtureKey, PosSession } from '@/lib/grooming-voucher-preview/types';
import { cn } from '@/lib/utils';
import { PreviewBanner } from './preview-banner';

const FIXTURES = listFixtureKeys();

const TABBABLE_SELECTOR =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function nextTabIndex(currentIndex: number, count: number, shiftKey: boolean): number {
  if (count <= 0) return 0;
  if (currentIndex < 0) return shiftKey ? count - 1 : 0;
  if (shiftKey) return currentIndex <= 0 ? count - 1 : currentIndex - 1;
  return currentIndex >= count - 1 ? 0 : currentIndex + 1;
}

export function isEscapeKey(key: string): boolean {
  return key === 'Escape';
}

function listTabbable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    (el) => el.getClientRects().length > 0,
  );
}

export function usePreviewDialogFocus(
  open: boolean,
  dialogRef: RefObject<HTMLElement | null>,
  triggerRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const rawPanel = dialogRef.current;
    if (!rawPanel) return;
    const panel: HTMLElement = rawPanel;

    const first = listTabbable(panel)[0] ?? panel;
    first.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (isEscapeKey(event.key)) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = listTabbable(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const index = items.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      items[nextTabIndex(index, items.length, event.shiftKey)]?.focus();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, dialogRef, triggerRef]);
}

export function PosGroomingVoucherPreviewApp() {
  const [session, setSession] = useState<PosSession>(() => createPosSession());
  const redeemTimer = useRef<number | null>(null);
  const reviewDialogRef = useRef<HTMLDivElement>(null);
  const reviewTriggerRef = useRef<HTMLButtonElement>(null);
  const codeId = useId();
  const amountId = useId();
  const confirmId = useId();
  const reasonId = useId();
  const fixtureId = useId();
  const reviewOpen = session.step === 'review';

  usePreviewDialogFocus(reviewOpen, reviewDialogRef, reviewTriggerRef, () => {
    setSession((current) => closeReview(current));
  });

  useEffect(() => {
    return () => {
      if (redeemTimer.current) window.clearTimeout(redeemTimer.current);
    };
  }, []);

  const voucher = currentVoucher(session);
  const blocked = Boolean(session.blockReason && session.liveMessage);
  const available = session.lookedUp && voucher.kind === 'available' && !session.redeemed;

  function confirmRedeem() {
    const next = startRedeem(session);
    setSession(next);
    if (!next.submitting) return;
    if (redeemTimer.current) window.clearTimeout(redeemTimer.current);
    redeemTimer.current = window.setTimeout(() => {
      setSession((current) => finishRedeem(current));
    }, 700);
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-canvas text-foreground">
      <div
        className="mx-auto flex min-h-screen w-full max-w-lg flex-col"
        {...(reviewOpen ? { inert: true, 'aria-hidden': true } : {})}
      >
        <PreviewBanner compact />

        <header className="flex items-start justify-between gap-3 px-4 pb-3 pt-5">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Furmosa 店家</p>
            <h1 className="truncate text-xl font-semibold text-navy">{POS_STORE_LABEL}</h1>
          </div>
          <Badge variant="outline">預覽</Badge>
        </header>

        <div className="px-4 pb-3">
          <label htmlFor={fixtureId} className="mb-1.5 block text-xs font-medium text-muted-foreground">
            預覽情境
          </label>
          <select
            id={fixtureId}
            className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={session.fixtureKey}
            onChange={(event) => setSession(switchFixture(session, event.target.value as FixtureKey))}
          >
            {FIXTURES.map((key) => (
              <option key={key} value={key}>
                {FIXTURE_LABELS[key]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 space-y-3 px-4 pb-8">
          {session.step === 'home' ? (
            <button
              type="button"
              onClick={() => setSession(openRedeemTask(session))}
              className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="shadow-card transition hover:border-primary/40">
                <CardContent className="flex min-h-[72px] items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{POS_TASK_TITLE}</p>
                    <p className="truncate text-sm text-muted-foreground">{POS_TASK_SUBTITLE}</p>
                  </div>
                  <span className="shrink-0 text-sm text-primary">開始</span>
                </CardContent>
              </Card>
            </button>
          ) : null}

          {session.step === 'lookup' || session.step === 'review' ? (
            <>
              <button
                type="button"
                className="min-h-11 text-left text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => setSession(goHome(session))}
              >
                ← 今天
              </button>
              <div className="space-y-2">
                <label htmlFor={codeId} className="text-sm font-medium text-navy">
                  券碼
                </label>
                <Input
                  id={codeId}
                  value={session.codeInput}
                  onChange={(event) => setSession(setCodeInput(session, event.target.value))}
                  className="min-h-11 font-mono tracking-wide"
                  autoComplete="off"
                  inputMode="text"
                  placeholder="輸入或模擬掃碼"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setSession(simulateScan(session))}
                  >
                    模擬掃碼
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11"
                    onClick={() => setSession(lookupVoucher(session))}
                  >
                    讀取券
                  </Button>
                </div>
              </div>

              {session.lookedUp ? (
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-navy">券資訊</p>
                      <StatusBadge kind={voucher.kind} label={voucher.statusLabel} />
                    </div>
                    <Fact label="會員" value={voucher.memberNicknameMasked} />
                    <Fact label="限本店" value={voucher.boundStoreLabel} />
                    <Fact label="券面" value={`NT$${voucher.faceValue}`} />
                    <Fact label="期限" value={voucher.expiresOn} />
                  </CardContent>
                </Card>
              ) : null}

              {available ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor={amountId} className="text-sm font-medium text-navy">
                      本次美容服務總額
                    </label>
                    <Input
                      id={amountId}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={session.serviceTotalInput}
                      onChange={(event) => setSession(setServiceTotalInput(session, event.target.value))}
                      className="min-h-11 tabular-nums"
                      placeholder="整數，必須高於券面"
                    />
                  </div>
                  <label
                    htmlFor={confirmId}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-card px-3"
                  >
                    <input
                      id={confirmId}
                      type="checkbox"
                      className="h-5 w-5 accent-[hsl(var(--coral))]"
                      checked={session.serviceConfirmed}
                      onChange={(event) => setSession(setServiceConfirmed(session, event.target.checked))}
                    />
                    <span className="text-sm font-medium text-navy">已完成美容服務</span>
                  </label>
                  <Button
                    ref={reviewTriggerRef}
                    type="button"
                    className="min-h-11 w-full"
                    onClick={() => setSession(openReview(session))}
                  >
                    檢查並核銷
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}

          {session.step === 'receipt' && session.receipt ? (
            <Card className="border-success/30">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-navy">核銷完成</h2>
                  <Badge variant="success">已核銷</Badge>
                </div>
                <Fact label="單號" value={session.receipt.reference} mono />
                <Fact label="時間" value={session.receipt.redeemedAtLabel} />
                <Fact label="門市" value={session.receipt.storeLabel} />
                <Fact label="補貼" value={`NT$${session.receipt.subsidyAmount}`} />
                <Fact label="服務總額" value={`NT$${session.receipt.serviceTotal}`} />

                {session.cancelSubmitted ? (
                  <p className="rounded-xl bg-muted px-3 py-2 text-sm text-navy">{COPY.cancelSubmitted}</p>
                ) : (
                  <div className="space-y-2">
                    <label htmlFor={reasonId} className="text-sm font-medium text-navy">
                      申請取消理由
                    </label>
                    <textarea
                      id={reasonId}
                      value={session.cancelReason}
                      onChange={(event) => setSession(setCancelReason(session, event.target.value))}
                      className="min-h-[88px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      placeholder="爭議要寫清楚"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 w-full"
                      onClick={() => setSession(submitCancelRequest(session))}
                    >
                      {COPY.applyCancel}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}

          <div aria-live="polite" aria-atomic="true" className="min-h-[1.5rem]">
            {session.liveMessage ? (
              <p
                className={cn(
                  'rounded-xl px-3 py-2 text-sm',
                  blocked ? 'bg-destructive/10 text-destructive' : 'bg-muted text-navy',
                )}
              >
                {session.liveMessage}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {reviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/40 p-0 sm:items-center sm:p-4">
          <button
            type="button"
            tabIndex={-1}
            className="absolute inset-0 cursor-default"
            aria-label="關閉確認"
            disabled={session.submitting}
            onClick={() => setSession((current) => closeReview(current))}
          />
          <div
            ref={reviewDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="redeem-review-title"
            tabIndex={-1}
            className="relative w-full max-w-lg rounded-t-2xl bg-card p-5 shadow-card sm:rounded-2xl"
          >
            <h2 id="redeem-review-title" className="text-base font-semibold text-navy">
              確認核銷
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{COPY.reviewHint}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <Fact label="服務總額" value={`NT$${session.serviceTotalInput}`} />
              <Fact label="Furmosa 固定補貼" value={`NT$${voucher.faceValue}`} />
              <p className="rounded-xl bg-muted px-3 py-2 text-sm text-navy">{COPY.storeCannotCancel}</p>
            </dl>
            <div className="mt-4 grid gap-2">
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={session.submitting}
                aria-busy={session.submitting}
                onClick={confirmRedeem}
              >
                {session.submitting ? '核銷中…' : COPY.confirmRedeem}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full"
                disabled={session.submitting}
                onClick={() => setSession((current) => closeReview(current))}
              >
                返回修改
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Fact({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('truncate text-sm font-medium text-navy', mono && 'font-mono')}>{value}</dd>
    </div>
  );
}

function StatusBadge({
  kind,
  label,
}: {
  kind: string;
  label: string;
}) {
  const variant =
    kind === 'available'
      ? 'success'
      : kind === 'offline'
        ? 'warning'
        : kind === 'wrong_store' || kind === 'expired' || kind === 'already_redeemed'
          ? 'destructive'
          : 'outline';
  return <Badge variant={variant}>{label}</Badge>;
}
