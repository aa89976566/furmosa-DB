'use client';

import { useState, useTransition } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { HqAdjustmentForm } from '@/components/orders/hq-adjustment-form';
import { loadReviewOrderEditor, reviewInboxDecision, reviewPaymentChoice } from '@/app/(main)/reviews/actions';
import type { ReviewResult } from '@/lib/orders/review-service';

type Editor = Awaited<ReturnType<typeof loadReviewOrderEditor>>;
export function OrderReviewActions({ orderId, sourceHash, reviewRevision, href, payment }: { payment?: string; orderId: string; sourceHash: string; reviewRevision: string; href: string }) {
  const [confirmedPayment, setConfirmedPayment] = useState(payment);
  const [currentHash, setCurrentHash] = useState(sourceHash);
  const [currentRevision, setCurrentRevision] = useState(reviewRevision);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [reviewPending, start] = useTransition();
  const [paymentPending, setPaymentPending] = useState(false);
  const pending = reviewPending || paymentPending;
  const paymentReady = confirmedPayment === 'paid';
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [generation, setGeneration] = useState(0);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  function decide(action: 'approve' | 'reject') {
    setResult(null);
    start(async () => {
      try {
        const next = await reviewInboxDecision({ orderId, sourceHash: currentHash, reviewRevision: currentRevision, action, reason: [reason, note.trim()].filter(Boolean).join('：') });
        setResult(next);
        if (!next.ok && next.blockers.some(text => text.includes('付款'))) setPaymentMessage('請先在上方確認已付清並儲存，再按通過。');
        if (next.ok) setRejectOpen(false);
      } catch { setResult({ ok: false, action: null, message: '連線中斷，請重新整理確認審核結果', kind: 'error', omsStatus: null, blockers: [], next: null }); }
    });
  }
  return <div className="w-full space-y-3">
    <fieldset disabled={pending} className="space-y-2"><legend className="text-sm font-medium">確認 HQ 付款狀態</legend>
      <div className="grid grid-cols-2 gap-2">{(['paid', 'pending'] as const).map(value => <Button key={value} type="button" variant={confirmedPayment === value ? 'default' : 'outline'} aria-pressed={confirmedPayment === value} className="min-h-11" onClick={async () => {
        if (!window.confirm(value === 'paid' ? '確認已收到此訂單全額款項？只記錄 HQ，不會向客人扣款或更新 Shopify。' : '確認將 HQ 訂單標示為未付款？')) return;
        setPaymentPending(true);
        try { const next = await reviewPaymentChoice({ orderId, sourceHash: currentHash, payment: value }); setPaymentMessage(next.message); setResult(null); if (next.ok && next.sourceHash) { setConfirmedPayment(next.payment); setCurrentHash(next.sourceHash); setCurrentRevision(next.reviewRevision); } }
          catch { setPaymentMessage('連線中斷，請重新整理確認付款狀態'); }
          finally { setPaymentPending(false); }
      }}>{value === 'paid' ? (paymentReady ? '已付清' : '確認已收款') : '未付款'}</Button>)}</div>
      {paymentMessage || !paymentReady ? <p role="status" className="text-sm">{paymentMessage || '請先確認付款，再移至待出貨。'}</p> : null}
    </fieldset>
    {result ? <div role={result.ok ? 'status' : 'alert'} className="rounded-lg border p-3 text-sm"><p>{result.action === 'reject' && result.ok ? `不通過原因：${[reason, note.trim()].filter(Boolean).join('：')}。訂單保留，可修改後重新送審。` : result.message}</p>{result.blockers.length ? <ul className="mt-2 list-inside list-disc">{[...new Set(result.blockers)].map(text => <li key={text}>{text}</li>)}</ul> : null}{result.ok && result.action === 'ship' && result.next ? <a href={result.next.href} className="mt-2 inline-block underline">查看待出貨單</a> : null}{!result.ok ? <a href={href} className="mt-2 inline-block underline">開啟完整資料處理</a> : null}</div> : null}
    <div className="grid grid-cols-3 gap-2 [&>button]:min-h-11">
      <Button className="col-span-3 sm:col-span-1" disabled={pending || !paymentReady || Boolean(result?.ok && result.action === 'ship')} onClick={() => decide('approve')}>{pending ? '處理中…' : '通過並移至待出貨'}</Button>
      <Button variant="outline" disabled={pending} onClick={() => start(async () => {
        setResult(null);
        try { const data = await loadReviewOrderEditor(orderId, currentHash); setEditor(data); setGeneration(value => value + 1); }
        catch (error) { setResult({ ok: false, action: null, message: error instanceof Error ? error.message : '無法開啟修改', kind: 'error', omsStatus: null, blockers: [], next: null }); }
      })}>修改</Button>
      <Button variant="outline" disabled={pending} onClick={() => { setReason(''); setNote(''); setRejectOpen(true); }}>不通過</Button>
    </div>
    <a href={href} className="block text-right text-xs underline underline-offset-4">完整訂單與收件配送</a>
    {editor ? <div className="[&>button]:hidden"><HqAdjustmentForm key={`${orderId}-${generation}`} {...editor} initiallyOpen /></div> : null}
    <Dialog.Root open={rejectOpen} onOpenChange={open => { if (!pending) setRejectOpen(open); }}><Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-xl border bg-background p-5 shadow-xl">
        <Dialog.Title className="text-lg font-semibold">不通過原因</Dialog.Title>
        <Dialog.Description className="text-sm text-muted-foreground">訂單保留在待審核，可修改後重新送審。</Dialog.Description>
        <label className="block text-sm">原因<select aria-label="不通過原因" value={reason} onChange={e => setReason(e.target.value)} className="mt-1 min-h-11 w-full rounded-lg border bg-background px-3"><option value="">請選擇</option>{['資料有誤', '缺貨', '客人取消', '其他'].map(value => <option key={value}>{value}</option>)}</select></label>
        <label className="block text-sm">補充說明<textarea value={note} maxLength={400} onChange={e => setNote(e.target.value)} className="mt-1 w-full rounded-lg border bg-background p-3" /></label>
        {result && !result.ok ? <p role="alert" className="text-sm">{result.message}</p> : null}
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={pending} onClick={() => setRejectOpen(false)}>返回</Button><Button disabled={pending || !reason || (reason === '其他' && !note.trim())} onClick={() => decide('reject')}>{pending ? '儲存中…' : '確認不通過'}</Button></div>
      </Dialog.Content>
    </Dialog.Portal></Dialog.Root>
  </div>;
}
