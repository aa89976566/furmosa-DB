'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { omsReviewAction } from '@/app/(main)/orders/oms-actions';
import type { ReviewDraft } from '@/lib/orders/review-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const invalidClass = 'border-foreground/35 bg-muted/50 focus-visible:ring-foreground/25';

function Temperature({ name, value }: { name: string; value: string }) {
  return <select aria-label="溫層" className={`${selectClass} ${value ? '' : invalidClass}`} name={name} defaultValue={value}>
    <option value="">請確認溫層</option><option value="ambient">常溫</option><option value="chilled">冷藏</option><option value="frozen">冷凍</option>
  </select>;
}

function Actions({ status }: { status: string }) {
  const { pending } = useFormStatus();
  return <div className="sticky bottom-3 z-10 flex flex-wrap justify-end gap-2 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
    <Button name="action" value="check" disabled={pending} variant={status === 'NEW' ? 'default' : 'outline'}>儲存並檢查</Button>
    {status === 'REVIEW' && <Button name="action" value="approve" disabled={pending}>確認訂單</Button>}
    {status === 'READY' && <Button name="action" value="ship" disabled={pending}>建立 HQ 出貨單</Button>}
    {pending && <span className="self-center text-sm text-muted-foreground" role="status">處理中…</span>}
  </div>;
}

function LabelText({ children, missing }: { children: string; missing: boolean }) {
  return <span className="flex items-center justify-between gap-2">{children}{missing && <em className="shrink-0 rounded-full bg-foreground px-2 py-0.5 not-italic text-[11px] font-medium text-background">待完成</em>}</span>;
}

export function OmsReviewForm({ orderId, sourceHash, status, draft, products, titles }: {
  orderId: string; sourceHash: string; status: string; draft: ReviewDraft;
  products: { id: string; name: string; sku: string }[]; titles: string[];
}) {
  const [state, action] = useFormState(omsReviewAction, { message: '' });
  const [method, setMethod] = useState(draft.method);
  const [contact, setContact] = useState(() => ({ recipient: draft.recipient, phone: draft.phone, address: draft.address, storeId: draft.storeId, storeName: draft.storeName }));
  return <form action={action} className="space-y-5">
    <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="sourceHash" value={sourceHash} />
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">商品</h3>
      {draft.lines.map((line, index) => <fieldset key={index} className={`grid gap-3 rounded-lg border p-3 sm:grid-cols-2 ${!line.productId || !line.temperature ? 'border-foreground/25' : ''}`}>
        <legend className="px-1 text-sm font-semibold">第 {index + 1} 項商品</legend>
        <p className="sm:col-span-2 text-sm"><span className="text-muted-foreground">Shopify 商品：</span>{titles[index]}</p>
        <label className="space-y-1.5 text-sm"><LabelText missing={!line.productId}>選擇 HQ 商品</LabelText><select className={`${selectClass} ${line.productId ? '' : invalidClass}`} name="productId" defaultValue={line.productId}><option value="">請選擇 HQ 商品</option>{products.map(product => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></label>
        <label className="space-y-1.5 text-sm"><LabelText missing={!line.temperature}>出貨溫層</LabelText><Temperature name="lineTemperature" value={line.temperature} /></label>
      </fieldset>)}
    </section>
    <section className="space-y-3 border-t pt-4">
      <h3 className="text-sm font-semibold">配送與收件</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-sm"><LabelText missing={!method}>配送方式</LabelText><select name="method" className={`${selectClass} ${method ? '' : invalidClass}`} value={method} onChange={event => setMethod(event.target.value as ReviewDraft['method'])}><option value="">請選擇</option><option value="home">黑貓宅配</option><option value="convenience">7-11 取貨</option></select></label>
        <label className="space-y-1.5 text-sm"><LabelText missing={!draft.temperature}>配送溫層</LabelText><Temperature name="temperature" value={draft.temperature} /></label>
        {([['recipient', '收件人'], ['phone', '收件電話'], ['address', '地址／門市地址']] as const).map(([name, label]) => <label className="space-y-1.5 text-sm" key={name}><LabelText missing={!contact[name].trim()}>{label}</LabelText><Input className={!contact[name].trim() ? invalidClass : ''} name={name} value={contact[name]} maxLength={500} onChange={event => setContact(current => ({ ...current, [name]: event.target.value }))} /></label>)}
        {method === 'convenience' && ([['storeId', '7-11 門市店號'], ['storeName', '7-11 門市名稱']] as const).map(([name, label]) => <label className="space-y-1.5 text-sm" key={name}><LabelText missing={!contact[name].trim()}>{label}</LabelText><Input className={!contact[name].trim() ? invalidClass : ''} name={name} value={contact[name]} maxLength={500} onChange={event => setContact(current => ({ ...current, [name]: event.target.value }))} /></label>)}
        {method !== 'convenience' && <><input type="hidden" name="storeId" value={contact.storeId} /><input type="hidden" name="storeName" value={contact.storeName} /></>}
      </div>
    </section>
    <div className="grid gap-2 rounded-lg bg-muted/30 p-3">
      <label className="flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" name="giftsConfirmed" defaultChecked={draft.giftsConfirmed} />已核對贈品、優惠及商品內容</label>
      <label className="flex items-start gap-2 text-sm"><input className="mt-0.5" type="checkbox" name="duplicateConfirmed" defaultChecked={draft.duplicateConfirmed} />若系統提示重複，已確認仍需出貨</label>
    </div>
    <Actions status={status} />
    {state.message && <p role="status" className="rounded-lg border p-3 text-sm">{state.message}</p>}
  </form>;
}
