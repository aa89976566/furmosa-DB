'use client';

import { useId, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { HQ_TAB_LABELS } from '@/lib/grooming-voucher-preview/copy';
import {
  HQ_CONSIGNMENT_ROWS,
  HQ_GROOMING_SUBSIDY_ROWS,
  HQ_SUMMARY_CARDS,
} from '@/lib/grooming-voucher-preview/fixtures';
import {
  approveConfirmCopy,
  approveRequest,
  cloneHqRequests,
  findRequest,
  lockedPeriodCopy,
  rejectRequest,
  requestsForTab,
} from '@/lib/grooming-voucher-preview/hq-logic';
import type { HqCancelRequest, HqCancelTab } from '@/lib/grooming-voucher-preview/types';
import { cn } from '@/lib/utils';
import { PreviewBanner } from './preview-banner';

const TABS: HqCancelTab[] = ['pending', 'approved', 'rejected'];

export function HqGroomingVoucherPreviewApp() {
  const [requests, setRequests] = useState(cloneHqRequests);
  const [tab, setTab] = useState<HqCancelTab>('pending');
  const [selectedId, setSelectedId] = useState<string | null>('cxl-preview-01');
  const [rejectNote, setRejectNote] = useState('');
  const [liveMessage, setLiveMessage] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);
  const rejectId = useId();

  const rows = useMemo(() => requestsForTab(requests, tab), [requests, tab]);
  const selected = selectedId ? findRequest(requests, selectedId) : undefined;

  function selectRow(id: string) {
    setSelectedId(id);
    setConfirmApprove(false);
    setRejectNote('');
    setLiveMessage('');
  }

  function onApprove() {
    if (!selected) return;
    const result = approveRequest(requests, selected.id);
    if (!result.ok) {
      setLiveMessage(result.error);
      return;
    }
    setRequests(result.requests);
    setConfirmApprove(false);
    setTab('approved');
    setLiveMessage('已核准。原券永久作廢。');
  }

  function onReject() {
    if (!selected) return;
    const result = rejectRequest(requests, selected.id, rejectNote);
    if (!result.ok) {
      setLiveMessage(result.error);
      return;
    }
    setRequests(result.requests);
    setRejectNote('');
    setTab('rejected');
    setLiveMessage('已拒絕這筆取消申請。');
  }

  return (
    <div className="overflow-x-hidden bg-canvas">
      <PreviewBanner />

      <div className="border-b border-border/70 bg-card/80 px-4 py-5 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Furmosa HQ</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-navy">美容券營運</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          看待審、核銷與補貼。美容券固定補貼和寄賣抽成分開算，不要混在同一張表。
        </p>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        <section aria-label="摘要">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {HQ_SUMMARY_CARDS.map((card) => (
              <div
                key={card.key}
                className="rounded-xl border border-border/70 bg-card px-3 py-3 shadow-card"
              >
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-navy">{card.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{card.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="取消申請">
              {TABS.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={tab === item}
                  className={cn(
                    'min-h-11 rounded-xl px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    tab === item
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-navy ring-1 ring-border',
                  )}
                  onClick={() => {
                    setTab(item);
                    const first = requestsForTab(requests, item)[0];
                    setSelectedId(first?.id ?? null);
                    setConfirmApprove(false);
                    setLiveMessage('');
                  }}
                >
                  {HQ_TAB_LABELS[item]}
                  <span className="ml-2 tabular-nums opacity-80">
                    {requestsForTab(requests, item).length}
                  </span>
                </button>
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card lg:block">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">會員</th>
                    <th className="px-3 py-2 font-medium">門市</th>
                    <th className="px-3 py-2 font-medium">券面</th>
                    <th className="px-3 py-2 font-medium">服務總額</th>
                    <th className="px-3 py-2 font-medium">核銷時間</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        'cursor-pointer border-t border-border/60',
                        selected?.id === row.id ? 'bg-accent' : 'hover:bg-muted/40',
                      )}
                      onClick={() => selectRow(row.id)}
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          className="min-h-11 text-left font-medium text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => selectRow(row.id)}
                        >
                          {row.memberNicknameMasked}
                        </button>
                      </td>
                      <td className="px-3 py-3">{row.storeLabel}</td>
                      <td className="px-3 py-3 tabular-nums">NT${row.faceValue}</td>
                      <td className="px-3 py-3 tabular-nums">NT${row.serviceTotal}</td>
                      <td className="px-3 py-3">{row.redeemedAtLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-2 lg:hidden">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => selectRow(row.id)}
                  className={cn(
                    'min-h-11 rounded-xl border bg-card p-3 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected?.id === row.id ? 'border-primary' : 'border-border/70',
                  )}
                >
                  <p className="font-medium text-navy">{row.memberNicknameMasked}</p>
                  <p className="text-sm text-muted-foreground">{row.storeLabel}</p>
                  <p className="mt-1 text-sm tabular-nums text-navy">
                    券面 NT${row.faceValue} · 服務 NT${row.serviceTotal}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <DetailPanel
            selected={selected}
            rejectId={rejectId}
            rejectNote={rejectNote}
            confirmApprove={confirmApprove}
            onRejectNote={setRejectNote}
            onAskApprove={() => setConfirmApprove(true)}
            onCancelApprove={() => setConfirmApprove(false)}
            onApprove={onApprove}
            onReject={onReject}
            onClose={() => setSelectedId(null)}
          />
        </section>

        <div aria-live="polite" className="min-h-[1.25rem] text-sm text-navy">
          {liveMessage}
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                  美容券固定補貼
                </p>
                <h2 className="mt-1 text-base font-semibold text-navy">Furmosa 補店家</h2>
                <p className="text-sm text-muted-foreground">只看券面補貼，不跟寄賣抽成加總。</p>
              </div>
              <ul className="space-y-2">
                {HQ_GROOMING_SUBSIDY_ROWS.map((row) => (
                  <li key={row.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-navy">
                      {row.storeLabel}
                      <span className="ml-2 text-xs text-muted-foreground">{row.redeemedAtLabel}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-medium text-navy">NT${row.faceValue}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-neutral-400">
            <CardContent className="space-y-3 p-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  寄賣抽成
                </p>
                <h2 className="mt-1 text-base font-semibold text-navy">商品寄賣</h2>
                <p className="text-sm text-muted-foreground">抽成是另一本帳，不要和美容券補貼排在一起對。</p>
              </div>
              <ul className="space-y-2">
                {HQ_CONSIGNMENT_ROWS.map((row) => (
                  <li key={row.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-navy">
                      {row.storeLabel}
                      <span className="ml-2 text-xs text-muted-foreground">{row.skuLabel}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-medium text-navy">
                      NT${row.commissionAmount}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function DetailPanel({
  selected,
  rejectId,
  rejectNote,
  confirmApprove,
  onRejectNote,
  onAskApprove,
  onCancelApprove,
  onApprove,
  onReject,
  onClose,
}: {
  selected: HqCancelRequest | undefined;
  rejectId: string;
  rejectNote: string;
  confirmApprove: boolean;
  onRejectNote: (value: string) => void;
  onAskApprove: () => void;
  onCancelApprove: () => void;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  if (!selected) {
    return (
      <aside className="hidden rounded-xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground xl:block">
        選一筆取消申請。
      </aside>
    );
  }

  const lockedCopy = lockedPeriodCopy(selected);

  return (
    <aside className="fixed inset-0 z-40 flex items-start justify-end p-3 xl:static xl:z-auto xl:p-0">
      <button
        type="button"
        className="absolute inset-0 bg-navy/40 xl:hidden"
        aria-label="關閉明細"
        onClick={onClose}
      />
      <div className="relative flex max-h-[92vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border/70 bg-card p-4 shadow-card xl:max-h-none xl:max-w-none">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">取消申請</p>
            <h2 className="text-base font-semibold text-navy">{selected.memberNicknameMasked}</h2>
          </div>
          <Button type="button" variant="ghost" className="min-h-11 xl:hidden" onClick={onClose}>
            關閉
          </Button>
        </div>

        <dl className="space-y-2 text-sm">
          <Row label="門市" value={selected.storeLabel} />
          <Row label="券面" value={`NT$${selected.faceValue}`} />
          <Row label="服務總額" value={`NT$${selected.serviceTotal}`} />
          <Row label="核銷時間" value={selected.redeemedAtLabel} />
          <div>
            <dt className="text-xs text-muted-foreground">申請理由</dt>
            <dd className="mt-1 text-sm text-navy">{selected.reason}</dd>
          </div>
        </dl>

        {lockedCopy ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {selected.lockedPeriodLabel} 已鎖帳。{lockedCopy}
          </p>
        ) : null}

        <ol className="mt-4 space-y-2 border-t border-border/70 pt-3">
          {selected.timeline.map((event) => (
            <li key={`${event.atLabel}-${event.title}`} className="text-sm">
              <p className="text-xs text-muted-foreground">{event.atLabel}</p>
              <p className="font-medium text-navy">{event.title}</p>
              <p className="text-muted-foreground">{event.detail}</p>
            </li>
          ))}
        </ol>

        {selected.tab === 'pending' ? (
          <div className="mt-4 space-y-3 border-t border-border/70 pt-3">
            {confirmApprove ? (
              <div className="space-y-2">
                <p className="text-sm text-navy">{approveConfirmCopy(selected)}</p>
                {lockedCopy ? <p className="text-sm text-amber-900">{lockedCopy}</p> : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" className="min-h-11" onClick={onApprove}>
                    確認核准
                  </Button>
                  <Button type="button" variant="outline" className="min-h-11" onClick={onCancelApprove}>
                    先不要
                  </Button>
                </div>
              </div>
            ) : (
              <Button type="button" className="min-h-11 w-full" onClick={onAskApprove}>
                核准取消
              </Button>
            )}

            <div className="space-y-2">
              <label htmlFor={rejectId} className="text-sm font-medium text-navy">
                拒絕備註
              </label>
              <textarea
                id={rejectId}
                value={rejectNote}
                onChange={(event) => onRejectNote(event.target.value)}
                className="min-h-[72px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="一句就好"
              />
              <Button type="button" variant="outline" className="min-h-11 w-full" onClick={onReject}>
                拒絕申請
              </Button>
            </div>
          </div>
        ) : null}

        {selected.tab === 'rejected' && selected.rejectNote ? (
          <p className="mt-3 text-sm text-navy">拒絕備註：{selected.rejectNote}</p>
        ) : null}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-navy">{value}</dd>
    </div>
  );
}
