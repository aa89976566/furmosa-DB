'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductCover } from '@/components/pos/product-cover';
import { confirmDirectShipmentReceiptAction } from './actions';

type ShipmentItem = {
  id: string;
  productName: string;
  quantity: number;
  sku: string;
  weightGrams: number | null;
  unit: string | null;
  imageUrl: string | null;
};

function itemMeta(item: ShipmentItem) {
  const details = [item.sku ? `SKU ${item.sku}` : null, item.weightGrams ? `${item.weightGrams}g` : null, item.unit].filter(Boolean);
  return details.join(' · ') || '補貨品項';
}

export function ReceiptManifest({ shipmentId, items, canConfirmReceipt }: { shipmentId: string; items: ShipmentItem[]; canConfirmReceipt: boolean }) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const checkedCount = checkedIds.length;
  const allChecked = items.length > 0 && checkedCount === items.length;
  const totalQuantity = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);

  function toggleItem(id: string) {
    setCheckedIds((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-border/80 bg-card shadow-[0_18px_48px_rgba(22,50,37,0.07)]">
      <div className="flex flex-col gap-1 border-b border-border px-5 py-5 sm:px-7">
        <div className="flex items-center justify-between gap-4"><h2 className="text-xl font-semibold tracking-tight text-foreground">商品明細</h2><span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{items.length} 項商品</span></div>
        <p className="text-sm text-muted-foreground">請逐項核對實物、數量與商品狀況。</p>
      </div>
      {items.length === 0 ? <p className="px-5 py-8 text-sm text-muted-foreground sm:px-7">尚未加入出貨品項</p> : (
        <div className="divide-y divide-border">
          <div className="hidden grid-cols-[minmax(0,1fr)_84px_100px] gap-4 bg-muted/45 px-7 py-3 text-xs font-medium tracking-wide text-muted-foreground md:grid"><span>商品</span><span className="text-center">數量</span><span className="text-center">核對</span></div>
          {items.map((item) => {
            const isChecked = checkedIds.includes(item.id);
            return <label key={item.id} className="grid cursor-pointer gap-4 px-5 py-4 transition-colors hover:bg-primary/[0.035] md:grid-cols-[minmax(0,1fr)_84px_100px] md:items-center md:px-7">
              <span className="flex min-w-0 items-center gap-4"><span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#eef5ef]"><ProductCover name={item.productName} imageUrl={item.imageUrl} imgClassName="h-full w-full object-cover" markClassName="flex h-full w-full items-center justify-center bg-primary/10 text-lg font-semibold text-primary" /></span><span className="min-w-0"><span className="block truncate font-semibold text-foreground">{item.productName}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{itemMeta(item)}</span></span></span>
              <span className="flex items-center justify-between text-sm md:justify-center"><span className="text-muted-foreground md:hidden">數量</span><span className="inline-flex min-w-10 justify-center rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">× {item.quantity}</span></span>
              <span className="flex items-center justify-between md:justify-center"><span className="text-sm text-muted-foreground md:hidden">已核對</span><input type="checkbox" className="peer sr-only" checked={isChecked} onChange={() => toggleItem(item.id)} disabled={!canConfirmReceipt} /><span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-transparent transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70"><CheckCircle2 className="h-5 w-5" aria-hidden /></span></span>
            </label>;
          })}
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border bg-muted/25 px-5 py-4 text-sm sm:px-7"><span className="text-muted-foreground">合計 <strong className="ml-1 font-semibold text-foreground">{totalQuantity}</strong> 件</span>{canConfirmReceipt ? <span className="font-medium text-primary">已核對 {checkedCount}/{items.length} 項</span> : null}</div>
      {canConfirmReceipt ? <div className="border-t border-border px-5 py-5 sm:px-7"><form action={confirmDirectShipmentReceiptAction}><input type="hidden" name="shipmentId" value={shipmentId} /><Button type="submit" disabled={!allChecked} className="group min-h-14 w-full rounded-2xl text-base shadow-[0_12px_26px_rgba(26,91,62,0.22)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(26,91,62,0.3)] active:translate-y-0 active:scale-[0.99]"><CheckCircle2 className="h-5 w-5 transition-transform duration-200 group-hover:scale-110" aria-hidden />收到這批貨，確認入庫</Button></form><p className="mt-3 text-center text-xs text-muted-foreground">確認後會立即加入店內庫存；若有不符，請先聯絡 HQ。</p></div> : null}
    </section>
  );
}
