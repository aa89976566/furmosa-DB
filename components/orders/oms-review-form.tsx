'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { omsReviewAction } from '@/app/(main)/orders/oms-actions';
import type { ReviewDraft } from '@/lib/orders/review-policy';
import type { ReviewLineDisplay } from '@/lib/orders/review-defaults';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OmsPromotionSummary } from './oms-promotion-summary';
import type { PromotionSummaryView } from '@/lib/orders/fulfillment-plan';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const invalidClass = 'border-foreground/35 bg-muted/50 focus-visible:ring-foreground/25';

const temperatureLabel: Record<string, string> = { ambient: '常溫', chilled: '冷藏', frozen: '冷凍' };
const methodLabel: Record<string, string> = { home: '黑貓宅配', convenience: '7-11 取貨' };

function Temperature({ name, value }: { name: string; value: string }) {
  return <select aria-label="溫層" className={`${selectClass} ${value ? '' : invalidClass}`} name={name} defaultValue={value}>
    <option value="">請確認溫層</option><option value="ambient">常溫</option><option value="chilled">冷藏</option><option value="frozen">冷凍</option>
  </select>;
}

function Actions({ status }: { status: string }) {
  const { pending } = useFormStatus();
  return <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
    <Button type="submit" name="action" value="check" disabled={pending} variant={status === 'NEW' ? 'default' : 'outline'}>儲存並檢查</Button>
    {status === 'REVIEW' && <Button type="submit" name="action" value="approve" disabled={pending}>確認訂單</Button>}
    {status === 'READY' && <Button type="submit" name="action" value="ship" disabled={pending}>建立 HQ 出貨單</Button>}
    {pending && <span className="self-center text-sm text-muted-foreground" role="status">處理中…</span>}
  </div>;
}

function LabelText({ children, missing }: { children: string; missing: boolean }) {
  return <span className="flex items-center justify-between gap-2">{children}{missing && <em className="shrink-0 rounded-full bg-foreground px-2 py-0.5 not-italic text-[11px] font-medium text-background">待完成</em>}</span>;
}

function ReadOnlyField({ label, value, name }: { label: string; value: string; name?: string }) {
  return <div className="space-y-1.5 text-sm">
    <p className="text-muted-foreground">{label}</p>
    <p className="min-h-10 rounded-md bg-muted/35 px-3 py-2.5 font-medium">{value}</p>
    {name ? <input type="hidden" name={name} value={value} /> : null}
  </div>;
}

type CatalogProduct = { id: string; name: string; sku: string };
type SourceSummary = {
  paymentLabel: string;
  paymentTone: 'ready' | 'hold' | 'danger';
  financialStatus: string;
  total: string;
  currency: string;
  recipient: string;
  phone: string;
  address: string;
  shippingLabel: string;
};

function ProductMapping({ mappingKind, conflictMessage, productId, products }: {
  mappingKind: ReviewLineDisplay['mappingKind']; conflictMessage: string; productId: string; products: CatalogProduct[];
}) {
  const product = products.find(item => item.id === productId);
  const summary = product ? `${product.sku} · ${product.name}` : productId;
  const select = <select className={`${selectClass} ${productId ? '' : invalidClass}`} name="productId" defaultValue={productId}>
    <option value="">請選擇 HQ 商品</option>
    {productId && !product && <option value={productId}>{productId}</option>}
    {products.map(item => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}
  </select>;

  if (mappingKind === 'auto' || mappingKind === 'saved') {
    return <div className="space-y-1.5 text-sm">
      <p className="text-muted-foreground">HQ 商品</p>
      <p className="min-h-10 rounded-md bg-muted/35 px-3 py-2.5 font-medium">{summary || '已自動對應'}</p>
      <p className="text-xs text-muted-foreground">{mappingKind === 'auto' ? 'Shopify 商品已自動對應' : '沿用已確認對應'}</p>
      <input type="hidden" name="productId" value={productId} />
    </div>;
  }

  return <label className="space-y-1.5 text-sm">
    <LabelText missing={!productId}>HQ 商品</LabelText>
    {mappingKind === 'conflict' && conflictMessage ? <p className="text-sm text-warning">{conflictMessage}</p> : null}
    {select}
  </label>;
}

function SourceOrderSummary({ source }: { source: SourceSummary }) {
  const tone = source.paymentTone === 'ready'
    ? 'border-success/40 bg-success/5'
    : source.paymentTone === 'danger'
      ? 'border-destructive/40 bg-destructive/5'
      : 'border-warning/40 bg-warning/5';
  const paymentNote = source.paymentTone === 'ready'
    ? '付款完成，可依審核結果進入出貨流程'
    : source.paymentTone === 'danger'
      ? '付款狀態異常，不可建立出貨'
      : '可先審核內容，但付款完成前不可建立出貨';
  const total = [source.currency, source.total].filter(Boolean).join(' ');
  return <section className="space-y-3 rounded-xl border bg-background p-4" aria-label="Shopify 原始訂單">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-muted-foreground">Shopify 原始訂單</p>
        <p className="mt-1 text-sm text-muted-foreground">HQ 以這份來源資料做履約判讀，不需要重新輸入相同內容。</p>
      </div>
      <div className={`rounded-lg border px-3 py-2 text-right ${tone}`}>
        <p className="text-xs text-muted-foreground">付款狀態</p>
        <p className="font-semibold">{source.paymentLabel}</p>
      </div>
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div><p className="text-xs text-muted-foreground">訂單金額</p><p className="font-semibold tabular-nums">{total || '待確認'}</p></div>
      <div><p className="text-xs text-muted-foreground">配送</p><p className="font-medium">{source.shippingLabel || '待系統判讀'}</p></div>
      <div><p className="text-xs text-muted-foreground">收件人</p><p className="font-medium">{source.recipient || '待補'}</p></div>
      <div><p className="text-xs text-muted-foreground">電話</p><p className="font-medium">{source.phone || '待補'}</p></div>
      <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">地址／門市地址</p><p className="break-words font-medium">{source.address || '待補'}</p></div>
    </div>
    <p className="border-t pt-3 text-xs text-muted-foreground">{paymentNote}</p>
  </section>;
}

export function OmsReviewForm({ orderId, sourceHash, status, draft, products, lineDisplays, promotionSummary, sourceSummary }: {
  orderId: string; sourceHash: string; status: string; draft: ReviewDraft;
  products: CatalogProduct[]; lineDisplays: ReviewLineDisplay[];
  promotionSummary?: PromotionSummaryView;
  sourceSummary: SourceSummary;
}) {
  const [state, action] = useFormState(omsReviewAction, { message: '' });
  const [method, setMethod] = useState(draft.method);
  return <form action={action} className="space-y-5">
    <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="sourceHash" value={sourceHash} />
    <SourceOrderSummary source={sourceSummary} />

    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold">HQ 履約判讀</h3>
        <p className="mt-1 text-xs text-muted-foreground">已能唯一判斷的欄位直接帶入；只有例外才需要人工選擇。</p>
      </div>
      {promotionSummary && <OmsPromotionSummary summary={promotionSummary} />}
      {draft.lines.map((line, index) => {
        const display = lineDisplays[index] ?? { title: '未命名商品', quantityLabel: '數量待確認', mappingKind: 'select' as const, conflictMessage: '' };
        const productResolved = (display.mappingKind === 'auto' || display.mappingKind === 'saved') && Boolean(line.productId);
        return <fieldset key={index} className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-2 ${!line.productId || !line.temperature ? 'border-foreground/25' : ''}`}>
          <legend className="px-1 text-sm font-semibold">第 {index + 1} 項商品</legend>
          <p className="sm:col-span-2 text-sm"><span className="text-muted-foreground">Shopify 商品：</span>{display.title} <span className={display.quantityLabel === '數量待確認' ? 'text-warning' : 'font-semibold'}>{display.quantityLabel}</span></p>
          <ProductMapping mappingKind={display.mappingKind} conflictMessage={display.conflictMessage} productId={line.productId} products={products} />
          {productResolved && line.temperature
            ? <ReadOnlyField label="出貨溫層" value={temperatureLabel[line.temperature] ?? line.temperature} />
            : <label className="space-y-1.5 text-sm"><LabelText missing={!line.temperature}>出貨溫層</LabelText><Temperature name="lineTemperature" value={line.temperature} /></label>}
          {productResolved && line.temperature ? <input type="hidden" name="lineTemperature" value={line.temperature} /> : null}
        </fieldset>;
      })}
    </section>

    <section className="space-y-3 border-t pt-4">
      <div>
        <h3 className="text-sm font-semibold">配送與收件</h3>
        <p className="mt-1 text-xs text-muted-foreground">Shopify 已提供的內容保持唯讀；缺資料時才需要補。</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {draft.method
          ? <><ReadOnlyField label="配送方式" value={methodLabel[draft.method] ?? draft.method} /><input type="hidden" name="method" value={draft.method} /></>
          : <label className="space-y-1.5 text-sm"><LabelText missing>配送方式</LabelText><select name="method" className={`${selectClass} ${invalidClass}`} value={method} onChange={event => setMethod(event.target.value as ReviewDraft['method'])}><option value="">請選擇</option><option value="home">黑貓宅配</option><option value="convenience">7-11 取貨</option></select></label>}
        {draft.temperature
          ? <><ReadOnlyField label="配送溫層" value={temperatureLabel[draft.temperature] ?? draft.temperature} /><input type="hidden" name="temperature" value={draft.temperature} /></>
          : <label className="space-y-1.5 text-sm"><LabelText missing>配送溫層</LabelText><Temperature name="temperature" value={draft.temperature} /></label>}

        {draft.recipient
          ? <><ReadOnlyField label="收件人" value={draft.recipient} /><input type="hidden" name="recipient" value={draft.recipient} /></>
          : <label className="space-y-1.5 text-sm"><LabelText missing>收件人</LabelText><Input className={invalidClass} name="recipient" maxLength={500} /></label>}
        {draft.phone
          ? <><ReadOnlyField label="收件電話" value={draft.phone} /><input type="hidden" name="phone" value={draft.phone} /></>
          : <label className="space-y-1.5 text-sm"><LabelText missing>收件電話</LabelText><Input className={invalidClass} name="phone" maxLength={500} /></label>}
        {draft.address
          ? <><ReadOnlyField label="地址／門市地址" value={draft.address} /><input type="hidden" name="address" value={draft.address} /></>
          : <label className="space-y-1.5 text-sm"><LabelText missing>地址／門市地址</LabelText><Input className={invalidClass} name="address" maxLength={500} /></label>}

        {method === 'convenience' || draft.method === 'convenience' ? <>
          {draft.storeId
            ? <><ReadOnlyField label="7-11 門市店號" value={draft.storeId} /><input type="hidden" name="storeId" value={draft.storeId} /></>
            : <label className="space-y-1.5 text-sm"><LabelText missing>7-11 門市店號</LabelText><Input className={invalidClass} name="storeId" maxLength={500} /></label>}
          {draft.storeName
            ? <><ReadOnlyField label="7-11 門市名稱" value={draft.storeName} /><input type="hidden" name="storeName" value={draft.storeName} /></>
            : <label className="space-y-1.5 text-sm"><LabelText missing>7-11 門市名稱</LabelText><Input className={invalidClass} name="storeName" maxLength={500} /></label>}
        </> : <><input type="hidden" name="storeId" value={draft.storeId} /><input type="hidden" name="storeName" value={draft.storeName} /></>}
      </div>
    </section>

    <details className="rounded-lg border bg-muted/20 p-3 text-sm">
      <summary className="cursor-pointer font-medium">例外確認</summary>
      <label className="mt-3 flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" name="duplicateConfirmed" defaultChecked={draft.duplicateConfirmed} />僅在系統提示疑似重複訂單時勾選：已確認仍需出貨</label>
    </details>
    {state.message && <p role="status" aria-live="polite" className="rounded-lg border bg-muted/30 p-3 text-sm font-medium">{state.message}</p>}
    <Actions status={status} />
  </form>;
}
