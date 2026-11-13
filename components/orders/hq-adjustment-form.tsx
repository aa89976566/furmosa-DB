'use client';
import { useEffect, useRef, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { hqAdjustmentAction } from '@/app/(main)/orders/hq-adjustment-actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AdjustmentData, AdjustmentLine } from '@/lib/orders/hq-adjustment';
import type { Snapshot } from '@/lib/shopify/intake-policy';
import { moneyToCents } from '@/lib/orders/money';

type Option = { id: string; label: string; price: string; sku: string };
type Row = AdjustmentLine & { label: string };
function Save() {
  const { pending } = useFormStatus();
  return <Button disabled={pending} type="submit">{pending ? '儲存中…' : '儲存並重新送審'}</Button>;
}
export function HqAdjustmentForm({ orderId, orderNumber, source, sourceHash, revision, metadata, options }: { orderId: string; orderNumber: string; source: Snapshot; sourceHash: string; revision: string; metadata: string | null; options: Option[] }) {
  const [state, action] = useFormState(hqAdjustmentAction, { message: '', ok: false });
  const router = useRouter();
  let previous: AdjustmentData | null = null;
  try { const data = JSON.parse(metadata ?? 'null'); if (data?.version === 1 && Array.isArray(data.after?.lines)) previous = data.after; } catch { /* Server rejects invalid audit data. */ }
  const originals = previous?.lines ?? (Array.isArray(source.order.line_items) ? source.order.line_items as Record<string, unknown>[] : []);
  const initialRows: Row[] = originals.map((line, sourceIndex) => ({ sourceIndex, quantity: Number(line.quantity), price: String(line.price ?? ''), label: String(line.title ?? '') }));
  const shipping = source.order.total_shipping_price_set as { shop_money?: { amount?: string } } | undefined;
  const initialShipping = previous?.shippingFee ?? shipping?.shop_money?.amount ?? '';
  const [rows, setRows] = useState(initialRows);
  const [shippingFee, setShippingFee] = useState(initialShipping);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'edit' | 'add' | 'confirm'>('edit');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState(1);
  const focusIndex = useRef<number | undefined>(undefined);
  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ orderId: string; index?: number; add: boolean }>).detail;
      if (detail.orderId !== orderId) return;
      focusIndex.current = detail.index;
      setMode(detail.add ? 'add' : 'edit'); setOpen(true);
    };
    document.addEventListener('hq-order-editor', receive);
    return () => document.removeEventListener('hq-order-editor', receive);
  }, [orderId]);
  useEffect(() => { if (state.ok) { setOpen(false); router.refresh(); } }, [state, router]);
  function close(next: boolean) {
    if (!next && (JSON.stringify(rows) !== JSON.stringify(initialRows) || shippingFee !== initialShipping || reason)) {
      if (!window.confirm('放棄尚未儲存的訂單修改？')) return;
      setRows(initialRows); setShippingFee(initialShipping); setReason('');
    }
    setOpen(next);
  }
  const money = (cents: number) => new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', minimumFractionDigits: 2 }).format(cents / 100);
  let total = moneyToCents(shippingFee);
  for (const row of rows) {
    const price = moneyToCents(row.price);
    const original = row.sourceIndex === undefined ? null : originals[row.sourceIndex];
    const discount = original && original.quantity === row.quantity && original.price === row.price ? moneyToCents(original.total_discount ?? '0') : 0;
    if (total === null || price === null || discount === null || !Number.isInteger(row.quantity) || row.quantity < 1 || row.quantity > 9999 || price * row.quantity < discount) { total = null; break; }
    total += price * row.quantity - discount;
  }
  const valid = total !== null && total <= 100000000 && rows.length > 0;
  const differences = rows.flatMap(row => {
    if (row.sourceIndex === undefined) return [`新增：${row.label} ×${row.quantity}，單價 ${row.price}`];
    const before = originals[row.sourceIndex];
    return before.quantity !== row.quantity || String(before.price) !== row.price ? [`修改：${row.label}，數量 ${before.quantity} → ${row.quantity}，單價 ${before.price} → ${row.price}`] : [];
  });
  originals.forEach((row, index) => { if (!rows.some(item => item.sourceIndex === index)) differences.push(`移除：${row.title} ×${row.quantity}`); });
  if (shippingFee !== initialShipping) differences.push(`運費：${initialShipping} → ${shippingFee}`);
  const shownOptions = options.filter(option => `${option.label} ${option.sku}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <Dialog.Root open={open} onOpenChange={close}>
    <Dialog.Trigger asChild><Button type="button" variant="outline">修改 HQ 訂單</Button></Dialog.Trigger>
    {state.message ? <p role="status">{state.message}</p> : null}
    <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
      <Dialog.Content aria-describedby="hq-editor-description" onOpenAutoFocus={event => {
        if (mode === 'edit' && focusIndex.current !== undefined) {
          const target = document.getElementById(`hq-row-${orderId}-${focusIndex.current}`);
          if (target) { event.preventDefault(); target.focus(); target.scrollIntoView({ block: 'center' }); }
        }
      }} className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl border bg-background shadow-xl sm:inset-y-0 sm:left-auto sm:right-0 sm:h-dvh sm:max-h-none sm:w-[520px] sm:rounded-none">
        <header className="flex items-start justify-between gap-3 border-b p-5"><div><Dialog.Title className="text-xl font-semibold">{mode === 'add' ? `新增商品到 ${orderNumber}` : mode === 'confirm' ? '確認本次修改' : `修改訂單 ${orderNumber}`}</Dialog.Title><Dialog.Description id="hq-editor-description" className="mt-1 text-sm text-muted-foreground">只修改這張 HQ 訂單，保留 Shopify 原單與操作紀錄。</Dialog.Description></div><Dialog.Close asChild><Button type="button" variant="ghost" size="sm">關閉</Button></Dialog.Close></header>
        <div className="overflow-y-auto p-5">
          {mode === 'add' ? <div className="space-y-4">
            <Input aria-label="搜尋商品名稱或 SKU" placeholder="搜尋商品名稱或 SKU" value={query} onChange={e => setQuery(e.target.value)} />
            <div className="max-h-[42dvh] overflow-y-auto rounded-lg border" role="radiogroup" aria-label="選擇商品與規格">{shownOptions.map(option => <label key={option.id} className="flex cursor-pointer items-start gap-3 border-b p-3 last:border-b-0"><input type="radio" name="product" value={option.id} checked={selected === option.id} onChange={() => setSelected(option.id)} className="mt-1" /><span className="min-w-0"><span className="block font-medium">{option.label}</span><span className="block text-sm text-muted-foreground">{option.sku} · NT${option.price}</span></span></label>)}{!shownOptions.length ? <p className="p-4">找不到符合的商品或規格</p> : null}</div>
            <label className="block text-sm">新增數量<Input type="number" min="1" max="9999" value={quantity} onChange={e => setQuantity(Number(e.target.value))} /></label>
            <Button type="button" className="w-full" disabled={!selected || !Number.isInteger(quantity) || quantity < 1 || quantity > 9999} onClick={() => { const option = options.find(item => item.id === selected); if (option) { setRows([...rows, { tierId: option.id, quantity, price: option.price, label: option.label }]); setSelected(''); setQuantity(1); setQuery(''); setMode('edit'); } }}>加入這張訂單</Button>
            <Button type="button" variant="outline" onClick={() => setMode('edit')}>返回修改內容</Button>
          </div> : <form action={action} onSubmit={event => { if (mode !== 'confirm' || !valid || !differences.length) event.preventDefault(); }} className="space-y-4">
            <input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="sourceHash" value={sourceHash} /><input type="hidden" name="revision" value={revision} /><input type="hidden" name="lines" value={JSON.stringify(rows.map(({ label: _label, ...row }) => row))} />
            <input type="hidden" name="shippingFee" value={shippingFee} />
            {mode === 'edit' ? <>
              <div className="flex justify-between gap-3"><h3 className="font-semibold">商品與備貨</h3><Button type="button" variant="outline" onClick={() => setMode('add')}>新增商品</Button></div>
              {rows.map((row, index) => <div key={row.sourceIndex === undefined ? `added-${index}` : `source-${row.sourceIndex}`} className="space-y-2 rounded-lg border p-3"><p className="font-medium">{row.label}</p><div className="flex flex-wrap gap-3"><label className="min-w-24 flex-1 text-sm">數量<Input id={`hq-row-${orderId}-${row.sourceIndex}`} type="number" min="1" max="9999" required value={row.quantity} onChange={e => setRows(rows.map((item, i) => i === index ? { ...item, quantity: Number(e.target.value) } : item))} /></label><label className="min-w-28 flex-1 text-sm">單價<Input type="number" min="0" step="0.01" required value={row.price} onChange={e => setRows(rows.map((item, i) => i === index ? { ...item, price: e.target.value } : item))} /></label></div><Button type="button" variant="outline" onClick={() => setRows(rows.filter((_, i) => i !== index))}>移除商品</Button></div>)}
              <label className="block text-sm">HQ 運費<Input type="number" min="0" step="0.01" required value={shippingFee} onChange={e => setShippingFee(e.target.value)} /></label>
              <p className="font-semibold">修改後總額：{valid ? money(total!) : '請檢查商品數量與金額'}</p>
              <Button type="button" className="w-full" disabled={!valid || !differences.length} onClick={() => setMode('confirm')}>查看修改並送審</Button>
            </> : <>
              <ul className="space-y-3 border-b pb-4">{differences.map((difference, index) => <li key={index}>{difference}</li>)}</ul>
              <dl className="space-y-3"><div className="flex justify-between gap-3"><dt>原總額</dt><dd>{money(moneyToCents(previous?.total ?? source.order.total_price) ?? 0)}</dd></div><div className="flex justify-between gap-3 bg-primary/5 p-3 font-semibold"><dt>新總額</dt><dd>{valid ? money(total!) : '金額無效'}</dd></div></dl>
              <label className="block text-sm">修改原因<Input name="reason" required maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="例如：客人電話加購商品" /></label>
              <p className="text-sm text-muted-foreground">儲存後回到待審核，保留操作人、時間、原因及修改前後內容。</p>
              {valid && differences.length ? <Save /> : <p role="alert">請先修正商品與金額</p>}
              <Button type="button" variant="outline" className="ml-2" onClick={() => setMode('edit')}>繼續編輯</Button>
              {state.message ? <p role="status">{state.message}</p> : null}
            </>}
          </form>}
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
