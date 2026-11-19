'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requestOmsReview } from '@/lib/orders/review-request';
import type { ReviewResult } from '@/lib/orders/review-service';
import { reviewAttentionTarget } from '@/lib/orders/review-attention';
import type { OmsIssue } from '@/lib/orders/oms';
import type { ReviewDraft } from '@/lib/orders/review-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';

type SourceSummary = { adminUrl?: string | null; subtotal?: string; shippingFee?: string; paymentLabel: string; paymentTone: 'ready' | 'hold' | 'danger'; total: string; currency: string; recipient: string; phone: string; address: string; shippingLabel: string; items?: { title: string; quantity: string; sku: string; contents?: string }[] };

function Actions({ status, summary, alertText, canCreateShipment, pendingShipmentReview = false, locked = false }: { status: string; summary: string; alertText: string; canCreateShipment: boolean; pendingShipmentReview?: boolean; locked?: boolean }) {
  const { pending } = useFormStatus();
  const pendingLabel = status === 'REVIEW'
    ? (canCreateShipment ? '正在確認並建立出貨單…' : '正在確認訂單…')
    : status === 'READY'
      ? '正在建立出貨單…'
      : '正在儲存並檢查…';
  return <div className="sticky bottom-3 z-10 space-y-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur" aria-busy={pending}>
    <div className="flex min-h-5 min-w-0 items-center gap-2 overflow-hidden text-sm"><p role="status" aria-live="polite" className="min-w-0 truncate font-medium">{pending ? pendingLabel : summary}</p><p role="alert" className="min-w-0 truncate font-medium text-destructive">{alertText}</p></div>
    <div className="flex flex-wrap justify-end gap-2">{(status === 'NEW' || status === 'REVIEW' || status === 'READY') && <Button type="submit" name="action" value="check" formNoValidate disabled={pending || locked} variant={status === 'NEW' ? 'default' : 'outline'}>{pendingShipmentReview ? '重新檢查出貨內容' : status === 'READY' ? '重新開啟審核' : '儲存並檢查'}</Button>}{status === 'REVIEW' && <Button type="submit" name="action" value="approve" disabled={pending || locked || !canCreateShipment}>{pending ? '處理中…' : !canCreateShipment ? '等待付款' : pendingShipmentReview ? '確認既有出貨單' : '通過並移至待出貨'}</Button>}{status === 'READY' && <Button type="submit" name="action" value="ship" disabled={pending || locked || !canCreateShipment}>{pending ? '建立中…' : canCreateShipment ? '建立 HQ 出貨單' : '等待付款'}</Button>}</div>
  </div>;
}

function ConfirmPaymentButton({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" name="action" value="confirm-payment" formNoValidate disabled={pending || locked}
      className="min-h-11" onClick={event => {
        if (!window.confirm('確認已收到這張訂單的全部款項？')) event.preventDefault();
      }}>
      確認已收款
    </Button>
  );
}

function SourceOrderSummary({ source }: { source: SourceSummary }) {
  const tone = source.paymentTone === 'ready' ? 'border-success/40 bg-success/5' : source.paymentTone === 'danger' ? 'border-destructive/40 bg-destructive/5' : 'border-warning/40 bg-warning/5';
  const total = [source.currency, source.total].filter(Boolean).join(' ');
  return <details data-review-target="source" className="rounded-lg border bg-background p-3 text-sm" aria-label="HQ 履約訂單"><summary className="cursor-pointer font-medium">訂單金額與來源明細</summary><div className="mt-4 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">HQ 履約訂單</p><p className="mt-1 text-sm text-muted-foreground">依 Shopify 原單及 HQ 人工調整呈現；所有修改保留操作紀錄。</p></div><div className={`rounded-lg border px-3 py-2 text-right ${tone}`}><p className="text-xs text-muted-foreground">付款狀態</p><p className="font-semibold">{source.paymentLabel}</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">訂單金額</p><p className="font-semibold tabular-nums">{total || '待確認'}</p></div><div><p className="text-xs text-muted-foreground">配送</p><p className="font-medium">{source.shippingLabel || 'Shopify 未提供配送資訊'}</p></div><div><p className="text-xs text-muted-foreground">收件人</p><p className="font-medium">{source.recipient || 'Shopify 未提供'}</p></div><div><p className="text-xs text-muted-foreground">電話</p><p className="font-medium">{source.phone || 'Shopify 未提供'}</p></div><div className="sm:col-span-2"><p className="text-xs text-muted-foreground">地址／門市地址</p><p className="break-words font-medium">{source.address || 'Shopify 未提供'}</p></div></div>
    <dl className="grid gap-3 border-t pt-3 sm:grid-cols-3" aria-label="HQ 金額明細">
      <div><dt className="text-sm text-muted-foreground">商品小計</dt><dd className="font-semibold tabular-nums">{source.subtotal ? `${source.currency} ${source.subtotal}` : '待同步'}</dd></div>
      <div><dt className="text-sm text-muted-foreground">實收運費</dt><dd className="font-semibold tabular-nums">{source.shippingFee ? `${source.currency} ${source.shippingFee}` : '待同步'}</dd></div>
      <div><dt className="text-sm text-muted-foreground">訂單總額</dt><dd className="font-semibold tabular-nums">{total || '待同步'}</dd></div>
    </dl>
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm">付款狀態依 Shopify 同步；商品調整請使用商品區的「新增商品／修改商品」。只有確認實際收到款項，才可標示已付款。</p>
      <div className="flex flex-wrap gap-2">
        {source.adminUrl ? <><Button asChild variant="outline"><a href={source.adminUrl} target="_blank" rel="noopener noreferrer">前往 Shopify 處理付款</a></Button></> : <p className="text-sm text-muted-foreground">來源訂單連結待確認，請從 Shopify 訂單列表查找。</p>}
      </div>
    </div>
    <div className="border-t pt-3"><p className="text-xs text-muted-foreground">商品明細</p><ul className="mt-2 space-y-2 text-sm">{(source.items ?? []).map((item, index) => <li key={`${item.sku}-${index}`} className="rounded-md bg-muted/30 p-2"><div className="flex justify-between gap-3"><span>{item.title}</span><span className="shrink-0 font-medium">{item.quantity}</span></div>{item.contents ? <details className="mt-2"><summary className="cursor-pointer text-xs">內部備貨與歷史資料</summary><p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{item.contents}</p></details> : null}</li>)}</ul></div>
  </div></details>;
}

async function submitReview(previous: ReviewResult, form: FormData): Promise<ReviewResult> {
  try {
    if (previous.uncertain) return previous;
    const result = await requestOmsReview(form);
    return previous.confirmedPaymentSourceHash && !result.confirmedPaymentSourceHash
      ? { ...result, confirmedPaymentSourceHash: previous.confirmedPaymentSourceHash }
      : result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const stalePage = /Failed to find Server Action|Server Action[^\n]*was not found on the server/i.test(message);
    // A disconnected request may already have committed. Keep the draft visible and
    // ask the operator to verify state rather than blindly retrying shipment creation.
    return { ok: false, action: null, omsStatus: null, blockers: [], next: null, kind: 'error', message: stalePage
      ? '系統已更新，這個頁面已過期。請重新載入訂單，核對狀態後再操作。'
      : '連線中斷，尚未確認操作結果。請重新整理核對訂單狀態後再操作。' };
  }
}

export function OmsReviewForm({ orderId, sourceHash, status, draft, sourceSummary, initialIssues = [], pendingShipmentReview = false }: { orderId: string; sourceHash: string; status: string; draft: ReviewDraft; sourceSummary: SourceSummary; initialIssues?: OmsIssue[]; pendingShipmentReview?: boolean }) {
  const [state, action] = useFormState(submitReview, { ok: null, action: null, message: '', omsStatus: null, blockers: [], kind: null, next: null });
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const attention = (state.issues ?? initialIssues).filter((issue, index, issues) => issue.severity === 'blocking' && issue.code !== 'PAYMENT_PENDING' && issues.findIndex(item => item.code === issue.code && item.message === issue.message) === index);
  function locateIssue(issue: OmsIssue) {
    const target = reviewAttentionTarget(issue.code);
    const scope = formRef.current;
    const element = target === 'products'
      ? scope?.closest('#oms-review')?.querySelector<HTMLElement>('[data-review-target="products"]')
      : scope?.querySelector<HTMLElement>(target === 'source' ? '[data-review-target="source"]' : `[name="${target}"]`);
    if (!element) return;
    if (element instanceof HTMLDetailsElement) element.open = true;
    let parent = element.parentElement;
    while (parent && parent !== scope?.parentElement) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    if (target !== 'source' && target !== 'products' && target !== 'duplicateConfirmed') setDeliveryOpen(true);
    const focus = element instanceof HTMLDetailsElement ? element.querySelector<HTMLElement>('summary') : element;
    focus?.focus();
    focus?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  const ok = state.ok ?? null;
  const effectiveStatus = state.ok && state.omsStatus ? state.omsStatus : status;
  const [method, setMethod] = useState(draft.method || (draft.storeName || draft.storeId ? 'convenience' : ''));
  const [storeId, setStoreId] = useState(draft.storeId);
  const [deliveryOpen, setDeliveryOpen] = useState(!draft.recipient || !draft.phone || !draft.address || !draft.method);
  const readyForShipment = effectiveStatus === 'READY';
  const canCreateShipment = sourceSummary.paymentTone === 'ready' || Boolean(state.confirmedPaymentSourceHash);
  const canConfirmPayment = !canCreateShipment && sourceSummary.paymentTone === 'hold' && !pendingShipmentReview && ['NEW', 'REVIEW', 'READY'].includes(effectiveStatus);

  useEffect(() => {
    // A check commits the fulfillment draft even when other checks still block approval.
    const draftSaved = state.action === 'check' && state.omsStatus === 'REVIEW' && state.kind !== 'error';
    if ((!state.ok && !draftSaved) || !state.action) return;
    if (state.next?.href?.startsWith('/shipments')) {
      // Keep the committed result visible; the operator opens shipping explicitly.
      return;
    }
    // Server Action path invalidation already refreshes the route after approval.
    // Only saved drafts need the explicit refresh used by the existing check flow.
    if (draftSaved) router.refresh();
    const targetId = state.action === 'ship' ? 'oms-shipping' : 'oms-review';
    const timer = window.setTimeout(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [router, state]);
  const isError = ok === false && state.kind === 'error';
  const hasBlockers = state.blockers.length > 0;
  const resultTone = isError ? 'border-destructive/40 bg-destructive/5' : (ok === false || hasBlockers) ? 'border-warning/40 bg-warning/5' : 'border-success/40 bg-success/5';
  // React 19 resets native controls after a completed form action, including blocked
  // checks. Keep this review draft until the source changes (the panel's key remounts
  // it); otherwise method resets to empty while the 7-11 fields remain visible.
  return <form ref={formRef} action={action} onReset={event => event.preventDefault()} className="space-y-5"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="sourceHash" value={state.confirmedPaymentSourceHash ?? sourceHash} />{pendingShipmentReview ? <input type="hidden" name="pendingShipmentReview" value="1" /> : null}{!readyForShipment && attention.length > 0 ? <section aria-label="待處理提示" className="rounded-xl border border-warning/40 bg-warning/5 p-4">
      <h3 className="font-semibold">還有 {attention.length} 項待處理</h3>
      <p className="mt-1 text-sm text-muted-foreground">點選問題前往處理，完成後按「儲存並檢查」。</p>
      <ul className="mt-3 divide-y divide-warning/20">{attention.map(issue => <li key={`${issue.code}-${issue.message}`}><button type="button" onClick={() => locateIssue(issue)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left text-sm transition-colors hover:bg-warning/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span>{issue.message}</span><span className="shrink-0 font-semibold underline underline-offset-4">前往處理</span></button></li>)}</ul>
      <p className="mt-2 text-sm text-muted-foreground">依最近一次檢查結果顯示，儲存後重新確認。</p>
    </section> : null}<SourceOrderSummary source={state.confirmedPaymentSourceHash
      ? { ...sourceSummary, paymentLabel: '已付款', paymentTone: 'ready' } : sourceSummary} />
    {readyForShipment ? <>
      <input type="hidden" name="method" value={draft.method} />
      <input type="hidden" name="temperature" value={draft.temperature} />
      <input type="hidden" name="recipient" value={draft.recipient} />
      <input type="hidden" name="phone" value={draft.phone} />
      <input type="hidden" name="address" value={draft.address} />
      <input type="hidden" name="storeId" value={draft.storeId} />
      <input type="hidden" name="storeName" value={draft.storeName} />
      <section className="rounded-xl border border-success/40 bg-success/5 p-4">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
          <div>
            <h3 className="font-semibold text-success">訂單已確認</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {draft.method === 'convenience'
                ? `配送：7-11 ${draft.storeName || '門市'}`
                : draft.method === 'home'
                  ? '配送：黑貓宅配'
                  : '配送資料已儲存'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{canCreateShipment ? '下一步只需要建立 HQ 出貨單，不必重新填寫審核資料。' : '尚未付款，訂單保留在待審核；付款完成後才能建立出貨單。'}</p>
          </div>
        </div>
      </section>
    </> : <details className="space-y-3 rounded-xl border bg-background p-4" open={deliveryOpen} onToggle={event => setDeliveryOpen(event.currentTarget.open)} onInvalidCapture={event => { event.currentTarget.open = true; setDeliveryOpen(true); }}><summary className="cursor-pointer"><span className="font-semibold">收件與配送</span><span className="mt-1 block text-sm text-muted-foreground">{draft.recipient || '收件人待補'} · {method === 'convenience' ? `7-11 ${draft.storeName || '門市待補'}` : method === 'home' ? '黑貓宅配' : '配送待確認'}　修改</span></summary>
      <div><h3 className="font-semibold">HQ 履約資料</h3><p className="mt-1 text-sm text-muted-foreground">可直接修改地址或門市後儲存，原配送方式會保留。其他待確認資料不影響保存；HQ 可補正履約資料，Shopify 原始資料保留供比對。</p></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">配送方式</span><select className="h-10 w-full rounded-md border bg-background px-3" name="method" value={method} onChange={event => setMethod(event.target.value)} required><option value="">請選擇</option><option value="home">黑貓宅配</option><option value="convenience">7-11 取貨</option></select></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">配送溫層（選填）</span><select className="h-10 w-full rounded-md border bg-background px-3" name="temperature" defaultValue={draft.temperature}><option value="">依 Shopify 配送設定</option><option value="ambient">常溫</option><option value="chilled">冷藏</option><option value="frozen">冷凍</option></select></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">收件人</span><Input name="recipient" defaultValue={draft.recipient} maxLength={500} required /></label>
        <label className="space-y-1 text-sm"><span className="text-muted-foreground">收件電話</span><Input name="phone" defaultValue={draft.phone} maxLength={500} required /></label>
        <label className="space-y-1 text-sm sm:col-span-2"><span className="text-muted-foreground">地址／門市地址</span><Input name="address" defaultValue={draft.address} maxLength={500} required /></label>
        {method === 'convenience' ? <><label className="space-y-1 text-sm"><span className="text-muted-foreground">7-11 門市店號（選填）</span><Input name="storeId" value={storeId} onChange={event => setStoreId(event.target.value)} placeholder="可留空" /></label><label className="space-y-1 text-sm"><span className="text-muted-foreground">7-11 門市名稱</span><Input name="storeName" defaultValue={draft.storeName} onChange={() => setStoreId('')} placeholder="例如：大銅門市" required /></label></> : <><input type="hidden" name="storeId" value={draft.storeId} /><input type="hidden" name="storeName" value={draft.storeName} /></>}
      </div>
    </details>}
    {!readyForShipment ? <details className="text-sm"><summary className="cursor-pointer py-2 text-muted-foreground">處理規則</summary><p className="mt-1 text-muted-foreground">人工調整僅影響 HQ 訂單與出貨內容；Shopify 原單保留。修改後請重新儲存並檢查，再確認訂單。</p></details> : null}<details className={readyForShipment ? "hidden" : "rounded-lg border bg-muted/20 p-3 text-sm"}><summary className="cursor-pointer font-medium">例外確認</summary><label className="mt-3 flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" name="duplicateConfirmed" defaultChecked={draft.duplicateConfirmed} />僅在系統提示疑似重複訂單時勾選：已確認仍需出貨</label></details>{ok != null ? <div className={`space-y-2 rounded-lg border p-3 text-sm ${resultTone}`} aria-live="polite"><p className="flex items-start gap-2 font-medium">{hasBlockers || !ok ? <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${isError ? 'text-destructive' : 'text-warning'}`} aria-hidden /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />}<span>{state.message}</span></p>{hasBlockers ? <><p className="font-medium">尚待條件</p><ul className="list-disc space-y-1 pl-5">{state.blockers.map(item => <li key={item}>{item}</li>)}</ul></> : null}{isError ? <a className="inline-flex font-medium underline underline-offset-4" href={`/orders/${encodeURIComponent(orderId)}`}>重新載入訂單並核對狀態</a> : null}{ok && state.next ? <a className="inline-flex font-medium underline underline-offset-4" href={state.next.href}>{state.next.label}</a> : null}</div> : null}{canConfirmPayment ? <ConfirmPaymentButton locked={Boolean(state.uncertain)} /> : null}<Actions status={effectiveStatus} summary={isError ? '' : (ok != null ? state.message : '')} alertText={isError ? state.message : ''} canCreateShipment={canCreateShipment} pendingShipmentReview={pendingShipmentReview} locked={Boolean(state.uncertain)} /></form>;
}
