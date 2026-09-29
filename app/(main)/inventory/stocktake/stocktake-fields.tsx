'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export function StocktakeFields() {
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('');
  const parsedQuantity = Number(quantity);
  const parsedTotal = Number(total);
  const unitCost = parsedQuantity > 0 && Number.isFinite(parsedTotal) ? parsedTotal / parsedQuantity : null;
  return <Card className="space-y-4 p-5">
    <label className="block text-sm font-medium">盤點後庫存（g）<Input className="mt-2" name="afterQuantity" type="number" min="0" step="1" required value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label>
    <label className="block text-sm font-medium">盤點後庫存總成本（NT$）<Input className="mt-2" name="afterTotalCost" type="number" min="0" step="0.01" required value={total} onChange={(event) => setTotal(event.target.value)} /></label>
    <div className="grid gap-3 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-3"><div><p className="text-muted-foreground">調整後庫存</p><p className="font-semibold">{quantity || '—'} g</p></div><div><p className="text-muted-foreground">調整後總成本</p><p className="font-semibold">{total ? `NT$${parsedTotal.toFixed(2)}` : '—'}</p></div><div><p className="text-muted-foreground">調整後單位成本</p><p className="font-semibold">{unitCost == null ? '—' : `NT$${unitCost.toFixed(6)}／g`}</p></div></div>
    <label className="block text-sm font-medium">調整原因<textarea className="mt-2 w-full rounded-md border bg-background px-3 py-2" name="reason" rows={3} required placeholder="例如：2026/09/29 實體盤點" /></label>
  </Card>;
}
