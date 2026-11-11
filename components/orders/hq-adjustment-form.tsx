'use client';
import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { hqAdjustmentAction } from '@/app/(main)/orders/hq-adjustment-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AdjustmentData, AdjustmentLine } from '@/lib/orders/hq-adjustment';
import type { Snapshot } from '@/lib/shopify/intake-policy';

type Option = { id: string; label: string; price: string };
function Save() {
  const { pending } = useFormStatus();
  return <Button disabled={pending} type="submit">{pending ? '儲存中…' : '儲存修改並重新送審'}</Button>;
}
export function HqAdjustmentForm({ orderId, source, sourceHash, revision, metadata, options }: { orderId: string; source: Snapshot; sourceHash: string; revision: string; metadata: string | null; options: Option[] }) {
  const [state, action] = useFormState(hqAdjustmentAction, { message: '', ok: false });
  let previous: AdjustmentData | null = null;
  try { const data = JSON.parse(metadata ?? 'null'); if (data?.version === 1 && Array.isArray(data.after?.lines)) previous = data.after; } catch { /* Existing invalid audit blocks server approval. */ }
  const originals = previous?.lines ?? (Array.isArray(source.order.line_items) ? source.order.line_items as Record<string, unknown>[] : []);
  const [rows, setRows] = useState<Array<AdjustmentLine & { label: string }>>(() => originals.map((line, sourceIndex) => ({ sourceIndex, quantity: Number(line.quantity), price: String(line.price ?? ''), label: String(line.title ?? '') })));
  const [selected, setSelected] = useState('');
  const shipping = source.order.total_shipping_price_set as { shop_money?: { amount?: string } } | undefined;
  return <details className="rounded-xl border bg-background p-4"><summary className="cursor-pointer font-semibold">修改 HQ 訂單</summary>
    <form action={action} className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">可新增、移除商品及修改數量、單價與運費。修改只影響 HQ；必填原因並保留修改前後紀錄。收件與配送資料可於下方審核表修改。</p>
      <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="sourceHash" value={sourceHash} /><input type="hidden" name="revision" value={revision} /><input type="hidden" name="lines" value={JSON.stringify(rows.map(({ label: _label, ...row }) => row))} />
      <div className="space-y-3">{rows.map((row, index) => <div key={index} className="space-y-2 rounded-lg border p-3">
        <p className="font-medium">{row.label}</p><div className="flex flex-wrap items-end gap-3">
          <label className="min-w-24 flex-1 text-sm">數量<Input type="number" min="1" max="9999" required value={row.quantity} onChange={e => setRows(rows.map((value, i) => i === index ? { ...value, quantity: Number(e.target.value) } : value))} /></label>
          <label className="min-w-28 flex-1 text-sm">單價<Input type="number" min="0" step="0.01" required value={row.price} onChange={e => setRows(rows.map((value, i) => i === index ? { ...value, price: e.target.value } : value))} /></label>
          <Button type="button" variant="outline" onClick={() => setRows(rows.filter((_, i) => i !== index))}>移除商品</Button>
        </div>
      </div>)}</div>
      <div className="flex flex-wrap gap-2"><select aria-label="新增商品規格" className="min-h-10 min-w-0 flex-1 rounded-md border bg-background p-2" value={selected} onChange={e => setSelected(e.target.value)}><option value="">選擇商品與規格</option>{options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select><Button type="button" variant="outline" disabled={!selected} onClick={() => { const option = options.find(item => item.id === selected); if (option) setRows([...rows, { tierId: option.id, quantity: 1, price: option.price, label: option.label }]); }}>新增商品</Button></div>
      <label className="block space-y-1 text-sm">HQ 運費<Input name="shippingFee" type="number" min="0" step="0.01" required defaultValue={previous?.shippingFee ?? shipping?.shop_money?.amount ?? ''} /></label>
      <label className="block space-y-1 text-sm">修改原因<Input name="reason" required maxLength={500} placeholder="例如 客人電話要求更換商品" /></label>
      {rows.length === 0 ? <p role="alert">請保留至少一項商品；整單移除請使用刪除訂單。</p> : <Save />}
      {state.message ? <p role="status" className={state.ok ? 'text-success' : 'text-destructive'}>{state.message}</p> : null}
    </form>
  </details>;
}
