'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { parseWeightFromName, productLabel } from '@/lib/product-label';

type Product = {
  id: string;
  name: string;
  sku: string;
  isConsigned: boolean;
  currentStock: number;
};

type Line = {
  productId: string;
  quantity: number;
  weightGrams: number | '';
  unit: string;
};

const UNIT_OPTIONS = ['包', '片', '支', '罐', '盒', '袋', '組', '件'];

export function RestockForm({ products }: { products: Product[] }) {
  const [lines, setLines] = useState<Line[]>([
    { productId: '', quantity: 1, weightGrams: '', unit: '包' },
  ]);

  function update(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function selectProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    const detected = p ? parseWeightFromName(p.name) : null;
    setLines((ls) =>
      ls.map((l, i) =>
        i === idx
          ? {
              ...l,
              productId,
              weightGrams: detected ?? l.weightGrams,
            }
          : l,
      ),
    );
  }

  function add() {
    setLines((ls) => [
      ...ls,
      { productId: '', quantity: 1, weightGrams: '', unit: '包' },
    ]);
  }

  function remove(idx: number) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, i) => i !== idx)));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-3 px-1 text-xs font-medium text-muted-foreground">
        <div className="col-span-5">商品</div>
        <div className="col-span-2 text-right">重量 (g)</div>
        <div className="col-span-2 text-right">數量</div>
        <div className="col-span-1 text-center">單位</div>
        <div className="col-span-1 text-right">現存</div>
        <div className="col-span-1"></div>
      </div>
      {lines.map((line, idx) => {
        const selected = products.find((p) => p.id === line.productId);
        const previewLabel = selected
          ? productLabel(
              selected.name,
              line.weightGrams === '' ? null : Number(line.weightGrams),
              line.unit,
            )
          : null;
        return (
          <div
            key={idx}
            className="grid grid-cols-12 items-start gap-3 rounded-lg border bg-muted/30 p-3"
          >
            <div className="col-span-5 space-y-1">
              <select
                name="productId"
                required
                value={line.productId}
                onChange={(e) => selectProduct(idx, e.target.value)}
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">請選擇商品</option>
                <optgroup label="-- 此店已寄賣 --">
                  {products
                    .filter((p) => p.isConsigned)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                </optgroup>
                <optgroup label="-- 其他商品 --">
                  {products
                    .filter((p) => !p.isConsigned)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku})
                      </option>
                    ))}
                </optgroup>
              </select>
              {previewLabel && (
                <div className="text-xs text-muted-foreground">
                  顯示：<span className="font-medium text-foreground">{previewLabel}</span>
                </div>
              )}
              {selected && !selected.isConsigned && (
                <div className="text-xs text-muted-foreground">
                  ⚠ 此商品還沒設定該店的售價/抽成規則
                </div>
              )}
            </div>
            <div className="col-span-2">
              <input
                name="weightGrams"
                type="number"
                min={0}
                step={1}
                value={line.weightGrams}
                onChange={(e) =>
                  update(idx, {
                    weightGrams: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                className="block w-full rounded-md border bg-background px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="50"
              />
            </div>
            <div className="col-span-2">
              <input
                name="quantity"
                type="number"
                min={1}
                step={1}
                required
                value={line.quantity}
                onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                className="block w-full rounded-md border bg-background px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="col-span-1">
              <select
                name="unit"
                value={line.unit}
                onChange={(e) => update(idx, { unit: e.target.value })}
                className="block w-full rounded-md border bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {UNIT_OPTIONS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-1 pt-2 text-right text-sm tabular-nums">
              {selected ? <Badge variant="secondary">{selected.currentStock}</Badge> : '-'}
            </div>
            <div className="col-span-1 text-right">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => remove(idx)}
                disabled={lines.length === 1}
                aria-label="移除這筆"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
        再加一筆
      </Button>
    </div>
  );
}
