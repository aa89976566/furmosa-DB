'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { omsReviewAction } from '@/app/(main)/orders/oms-actions';
import type { ReviewDraft } from '@/lib/orders/review-policy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
function Temperature({ name, value }: { name: string; value: string }) {
  return <select aria-label="溫層" className={selectClass} name={name} defaultValue={value}>
    <option value="">請確認溫層</option><option value="ambient">常溫</option>
    <option value="chilled">冷藏</option><option value="frozen">冷凍</option>
  </select>;
}
function Actions({ status }: { status: string }) {
  const { pending } = useFormStatus();
  return <div className="sticky bottom-2 z-10 flex gap-2 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur sm:static sm:flex-wrap sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
    <Button className="flex-1 sm:flex-none" name="action" value="check" disabled={pending} variant="outline">儲存並檢查</Button>
    {status === 'REVIEW' && <Button className="flex-1 sm:flex-none" name="action" value="approve" disabled={pending}>確認訂單</Button>}
    {status === 'READY' && <Button className="flex-1 sm:flex-none" name="action" value="ship" disabled={pending}>建立 HQ 出貨單</Button>}
    {pending && <span role="status">處理中…</span>}
  </div>;
}
function ContactFields({ draft }: { draft: ReviewDraft }) {
  const completeHomeDelivery = draft.method === 'home' && Boolean(draft.recipient && draft.phone && draft.address);
  const [editing, setEditing] = useState(!completeHomeDelivery);
  if (!editing) return <div className="rounded-lg border bg-muted/20 p-3 text-sm">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p className="font-medium">Shopify 已帶入收件資料</p>
        <p className="mt-1 text-muted-foreground">{draft.recipient} · {draft.phone}</p>
        <p className="mt-1 break-words text-muted-foreground">{draft.address}</p>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>修改</Button>
    </div>
    <input type="hidden" name="recipient" value={draft.recipient} />
    <input type="hidden" name="phone" value={draft.phone} />
    <input type="hidden" name="address" value={draft.address} />
    <input type="hidden" name="storeId" value={draft.storeId} />
    <input type="hidden" name="storeName" value={draft.storeName} />
  </div>;
  return <div className="grid gap-3 sm:grid-cols-2">
    {([['recipient', '收件人'], ['phone', '收件電話'], ['address', '地址／門市地址'], ['storeId', '7-11 門市店號'], ['storeName', '7-11 門市名稱']] as const).map(([name, label]) =>
      <label className="space-y-1 text-sm" key={name}>{label}<Input name={name} defaultValue={draft[name]} maxLength={500} /></label>)}
  </div>;
}
export function OmsReviewForm({ orderId, sourceHash, status, draft, products, titles }: {
  orderId: string; sourceHash: string; status: string; draft: ReviewDraft;
  products: { id: string; name: string; sku: string }[]; titles: string[];
}) {
  const [state, action] = useFormState(omsReviewAction, { message: '' });
  return <form action={action} className="space-y-4">
    <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="sourceHash" value={sourceHash} />
    {draft.lines.map((line, index) => <fieldset key={index} className="grid gap-2 rounded border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm">{index + 1}. {titles[index]}</legend>
      <label className="space-y-1 text-sm">HQ 商品<select className={selectClass} name="productId" defaultValue={line.productId}>
        <option value="">請選擇商品</option>{products.map(p => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
      </select></label>
      <label className="space-y-1 text-sm">商品溫層<Temperature name="lineTemperature" value={line.temperature} /></label>
    </fieldset>)}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">配送方式<select name="method" className={selectClass} defaultValue={draft.method}>
        <option value="">請選擇</option><option value="home">黑貓宅配</option><option value="convenience">7-11 取貨</option>
      </select></label>
      <label className="space-y-1 text-sm">配送溫層<Temperature name="temperature" value={draft.temperature} /></label>
    </div>
    <ContactFields draft={draft} />
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="giftsConfirmed" defaultChecked={draft.giftsConfirmed} />我已核對贈品、優惠及商品內容</label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="duplicateConfirmed" defaultChecked={draft.duplicateConfirmed} />若有重複訂單提示，我已確認這筆仍需要出貨</label>
    <Actions status={status} />
    {state.message && <p role="status" className="rounded border p-3 text-sm">{state.message}</p>}
  </form>;
}
