'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { omsReviewAction } from '@/app/(main)/orders/oms-actions';
import type { ReviewDraft } from '@/lib/orders/review-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SourceSummary = { paymentLabel: string; paymentTone: 'ready' | 'hold' | 'danger'; total: string; currency: string; recipient: string; phone: string; address: string; shippingLabel: string; items?: { title: string; quantity: string; sku: string }[] };

function Actions({ status, summary, alertText }: { status: string; summary: string; alertText: string }) {
  const { pending } = useFormStatus();
  return <div className="sticky bottom-3 z-10 space-y-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur" aria-busy={pending}>
    <div className="flex max-h-8 min-w-0 items-center gap-2 overflow-hidden text-sm"><p role="status" aria-live="polite" className="min-w-0 truncate font-medium">{summary}</p><p role="alert" className="min-w-0 truncate font-medium text-destructive">{alertText}</p></div>
    <div className="flex flex-wrap justify-end gap-2"><Button type="submit" name="action" value="check" disabled={pending} variant={status === 'NEW' ? 'default' : 'outline'}>儲存並檢查</Button>{status === 'REVIEW' && <Button type="submit" name="action" value="approve" disabled={pending}>確認訂單</Button>}{status === 'READY' && <Button type="submit" name="action" value="ship" disabled={pending}>建立 HQ 出貨單</Button>}{pending && <span className="self-center text-sm text-muted-foreground">處理中…</span>}</div>
  </div>;
}

function SourceOrderSummary({ source }: { source: SourceSummary }) {
  const tone = source.paymentTone === 'ready' ? 'border-success/40 bg-success/5' : source.paymentTone === 'danger' ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5';
  const total = [source.currency, source.total].filter(Boolean).join(' ');
  return <section className="space-y-3 rounded-xl border bg-background p-4" aria-label="Shopify 原始訂單">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Shopify 原始訂單</p><p className="mt-1 text-sm text-muted-foreground">HQ 直接呈現 Shopify 商品與配送資料，不需重新選擇商品或出貨溫層。</p></div><div className={`rounded-lg border px-3 py-2 text-right ${tone}`}><p className="text-xs text-muted-foreground">付款狀態</p><p className="font-semibold">{source.paymentLabel}</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">訂單金額</p><p className="font-semibold tabular-nums">{total || '待確認'}</p></div><div><p className="text-xs text-muted-foreground">配送</p><p className="font-medium">{source.shippingLabel || 'Shopify 未提供配送資訊'}</p></div><div><p className="text-xs text-muted-foreground">收件人</p><p className="font-medium">{source.recipient || 'Shopify 未提供'}</p></div><div><p className="text-xs text-muted-foreground">電話</p><p className="font-medium">{source.phone || 'Shopify 未提供'}</p></div><div className="sm:col-span-2"><p className="text-xs text-muted-foreground">地址／門市地址</p><p className="break-words font-medium">{source.address || 'Shopify 未提供'}</p></div></div>
    <div className="border-t pt-3"><p className="text-xs text-muted-foreground">商品明細</p><ul className="mt-2 space-y-1.5 text-sm">{(source.items ?? []).map((item, index) => <li key={`${item.sku}-${index}`} className="flex justify-between gap-3"><span>{item.title}</span><span className="shrink-0 font-medium">{item.quantity}</span></li>)}</ul></div>
  </section>;
}

export function OmsReviewForm({ orderId, sourceHash, status, draft, sourceSummary }: { orderId: string; sourceHash: string; status: string; draft: ReviewDraft; sourceSummary: SourceSummary }) {
  const [state, action] = useFormState(omsReviewAction, { ok: null, action: null, message: '', omsStatus: null, blockers: [], kind: null, next: null });
  const ok = state.ok ?? null;
  const [method, setMethod] = useState(draft.method);
  const isError = ok === false && state.kind === 'error';
  const hasBlockers = state.blockers.length > 0;
  const resultTone = isError ? 'border-destructive/40 bg-destructive/5' : (ok === false || hasBlockers) ? 'border-warning/40 bg-warning/5' : 'border-success/40 bg-success/5';
  return <form action={action} className="space-y-5"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="sourceHash" value={sourceHash} /><SourceOrderSummary source={sourceSummary} />
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <div><h3 className="font-semibold">HQ 履約資料</h3><p className="mt-1 text-sm text-muted-foreground">Shopify 原始資料保留供比對；以下欄位 HQ 可補正，儲存後會用於實際出貨。</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">配送方式</span><select className="h-10 w-full rounded-md border bg-background px-3" name="method" value={method} onChange={event => setMethod(event.target.value)} required><option value="">請選擇</option><option value="home">黑貓宅配</option><option value="convenience">7-11 取貨</option></select></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">配送溫層（選填）</span><select className="h-10 w-full rounded-md border bg-background px-3" name="temperature" defaultValue={draft.temperature}><option value="">依 Shopify 配送設定</option><option value="ambient">常溫</option><option value="chilled">冷藏</option><option value="frozen">冷凍</option></select></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">收件人</span><Input name="recipient" defaultValue={draft.recipient} maxLength={500} required /></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">收件電話</span><Input name="phone" defaultValue={draft.phone} maxLength={500} required /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="text-muted-foreground">地址／門市地址</span><Input name="address" defaultValue={draft.address} maxLength={500} required /></label>
        {method === 'convenience' ? <><label className="space-y-1 text-sm"><span className="text-muted-foreground">7-11 門市店號</span><Input name="storeId" defaultValue={draft.storeId} placeholder="六位數店號" required /></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">7-11 門市名稱</span><Input name="storeName" defaultValue={draft.storeName} placeholder="例如：大銅門市" required /></label></> : <><input type="hidden" name="storeId" value={draft.storeId} /><input type="hidden" name="storeName" value={draft.storeName} /></>}
      </div>
    </section>
    <section className="rounded-lg border bg-muted/20 p-3 text-sm"><h3 className="font-semibold">處理規則</h3><p className="mt-1 text-muted-foreground">商品與數量仍以 Shopify 訂單為準；HQ 補正只影響實際履約與出貨資料。</p></section><details className="rounded-lg border bg-muted/20 p-3 text-sm"><summary className="cursor-pointer font-medium">例外確認</summary><label className="mt-3 flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" name="duplicateConfirmed" defaultChecked={draft.duplicateConfirmed} />僅在系統提示疑似重複訂單時勾選：已確認仍需出貨</label></details>{ok != null ? <div className={`space-y-2 rounded-lg border p-3 text-sm ${resultTone}`} aria-live="polite"><p className="flex items-start gap-2 font-medium">{hasBlockers || !ok ? <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${isError ? 'text-destructive' : 'text-warning'}`} aria-hidden /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />}<span>{state.message}</span></p>{hasBlockers ? <><p className="font-medium">尚待條件</p><ul className="list-disc space-y-1 pl-5">{state.blockers.map(item => <li key={item}>{item}</li>)}</ul></> : null}{ok && state.next ? <a className="inline-flex font-medium underline underline-offset-4" href={state.next.href}>{state.next.label}</a> : null}</div> : null}<Actions status={status} summary={isError ? '' : (ok != null ? state.message : '')} alertText={isError ? state.message : ''} /></form>;
}
