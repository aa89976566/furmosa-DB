'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { HqAdjustmentForm } from '@/components/orders/hq-adjustment-form';
import { loadReviewOrderEditor, reviewInboxDecision } from '@/app/(main)/reviews/actions';
import type { ReviewResult } from '@/lib/orders/review-service';

type Editor = Awaited<ReturnType<typeof loadReviewOrderEditor>>;
export function OrderReviewActions({ orderId, sourceHash, href }: { orderId: string; sourceHash: string; href: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
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
        const next = await reviewInboxDecision({ orderId, sourceHash, action, reason: [reason, note.trim()].filter(Boolean).join('：') });
        setResult(next);
        if (next.ok) { setRejectOpen(false); router.refresh(); }
      } catch { setResult({ ok: false, action: null, message: '連線中斷，請重新整理確認審核結果', kind: 'error', omsStatus: null, blockers: [], next: null }); }
    });
  }
  return <div className="w-full space-y-3">
    {result ? <div role={result.ok ? 'status' : 'alert'} className="rounded-lg border p-3 text-sm"><p>{result.ok && result.action === 'approve' ? '審核通過，可前往訂單建立出貨單' : result.message}</p>{result.blockers.length ? <ul className="mt-2 list-inside list-disc">{[...new Set(result.blockers)].map(text => <li key={text}>{text}</li>)}</ul> : null}{!result.ok ? <a href={href} className="mt-2 inline-block underline">開啟完整資料處理</a> : null}</div> : null}
    <div className="grid grid-cols-3 gap-2 [&>button]:min-h-11">
      <Button disabled={pending} onClick={() => decide('approve')}>{pending ? '處理中…' : '通過'}</Button>
      <Button variant="outline" disabled={pending} onClick={() => start(async () => {
        setResult(null);
        try { const data = await loadReviewOrderEditor(orderId, sourceHash); setEditor(data); setGeneration(value => value + 1); }
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
