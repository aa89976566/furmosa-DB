'use client';

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
  return <div className="flex flex-wrap gap-2">
    <Button name="action" value="check" disabled={pending} variant="outline">儲存並檢查</Button>
    {status === 'REVIEW' && <Button name="action" value="approve" disabled={pending}>確認訂單</Button>}
    {status === 'READY' && <Button name="action" value="ship" disabled={pending}>建立 HQ 出貨單</Button>}
    {pending && <span role="status">處理中…</span>}
  </div>;
}
export function OmsReviewForm({ orderId, sourceHash, status, draft, products, titles }: {
  orderId: string; sourceHash: string; status: string; draft: ReviewDraft;
  products: { id: string; name: string; sku: string }[]; titles: string[];
}) {
  const [state, action] = useFormState(omsReviewAction, { message: '' });
  return <form action={action} className="space-y-4">
    <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="sourceHash" value={sourceHash} />
    <p className="text-sm text-muted-foreground">先儲存檢查，再確認訂單。修改資料後必須重新檢查；建立 HQ 出貨單不等於已送到物流公司。</p>
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
      {([['recipient', '收件人'], ['phone', '收件電話'], ['address', '地址／門市地址'], ['storeId', '7-11 門市店號'], ['storeName', '7-11 門市名稱']] as const).map(([name, label]) =>
        <label className="space-y-1 text-sm" key={name}>{label}<Input name={name} defaultValue={draft[name]} maxLength={500} /></label>)}
    </div>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="giftsConfirmed" defaultChecked={draft.giftsConfirmed} />我已核對贈品、優惠及商品內容</label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="duplicateConfirmed" defaultChecked={draft.duplicateConfirmed} />若有重複訂單提示，我已確認這筆仍需要出貨</label>
    <Actions status={status} />
    {state.message && <p role="status" className="rounded border p-3 text-sm">{state.message}</p>}
  </form>;
}
