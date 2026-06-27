'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { parseWeightFromName, productLabel } from '@/lib/product-label';
import { variationLabel } from '@/lib/product-variations';

type ProductTierOption = {
  id: string;
  weightGrams: number | null;
  unit: string;
  unitQty: number;
  price: number;
  notes: string | null;
};

export type RestockProductOption = {
  id: string;
  name: string;
  sku: string;
  isConsigned: boolean;
  currentStock: number;
  defaultUnit: string;
  priceTiers: ProductTierOption[];
};

type Line = {
  productId: string;
  tierId: string;
  quantity: number;
  weightGrams: number | '';
  unit: string;
};

import { ORDER_LINE_UNIT_OPTIONS } from '@/lib/product-units';

function weightFromTier(tier?: ProductTierOption | null) {
  if (!tier?.weightGrams || tier.weightGrams <= 0) return '';
  return tier.weightGrams;
}

export function RestockForm({ products }: { products: RestockProductOption[] }) {
  const [lines, setLines] = useState<Line[]>([
    { productId: '', tierId: '', quantity: 1, weightGrams: '', unit: '包' },
  ]);

  function update(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function selectProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) {
      setLines((ls) =>
        ls.map((l, i) =>
          i === idx
            ? { productId: '', tierId: '', quantity: 1, weightGrams: '', unit: '包' }
            : l,
        ),
      );
      return;
    }

    if (p.priceTiers.length > 0) {
      const tier = p.priceTiers[0];
      setLines((ls) =>
        ls.map((l, i) =>
          i === idx
            ? {
                ...l,
                productId,
                tierId: tier.id,
                weightGrams: weightFromTier(tier),
                unit: tier.unit,
              }
            : l,
        ),
      );
      return;
    }

    const detected = parseWeightFromName(p.name);
    setLines((ls) =>
      ls.map((l, i) =>
        i === idx
          ? {
              ...l,
              productId,
              tierId: '',
              quantity: l.quantity,
              weightGrams: detected ?? '',
              unit: p.defaultUnit || '包',
            }
          : l,
      ),
    );
  }

  function selectTier(idx: number, tierId: string) {
    const line = lines[idx];
    const p = products.find((x) => x.id === line.productId);
    const tier = p?.priceTiers.find((x) => x.id === tierId);
    if (!p || !tier) return;
    setLines((ls) =>
      ls.map((current, i) =>
        i === idx
          ? {
              ...current,
              tierId,
              weightGrams: weightFromTier(tier),
              unit: tier.unit,
            }
          : current,
      ),
    );
  }

  function add() {
    setLines((ls) => [
      ...ls,
      { productId: '', tierId: '', quantity: 1, weightGrams: '', unit: '包' },
    ]);
  }

  function remove(idx: number) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, i) => i !== idx)));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-3 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <div className="col-span-4">商品</div>
        <div className="col-span-3">規格</div>
        <div className="col-span-2 text-right">數量</div>
        <div className="col-span-1 text-center">單位</div>
        <div className="col-span-1 text-right">現存</div>
        <div className="col-span-1"></div>
      </div>
      {lines.map((line, idx) => {
        const selected = products.find((p) => p.id === line.productId);
        const hasTiers = (selected?.priceTiers.length ?? 0) > 0;
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
            className="grid grid-cols-12 items-start gap-3 rounded-xl border border-border/70 bg-muted/30 p-4"
          >
            <div className="col-span-4 space-y-1">
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
            <div className="col-span-3 space-y-1">
              <input type="hidden" name="weightGrams" value={line.weightGrams} />
              {hasTiers ? (
                <select
                  value={line.tierId}
                  onChange={(e) => selectTier(idx, e.target.value)}
                  className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {selected!.priceTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {variationLabel(tier)}
                      {tier.notes ? ` · ${tier.notes}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {selected ? '無規格（重量依品名或使用單位）' : '請先選商品'}
                </div>
              )}
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
                {ORDER_LINE_UNIT_OPTIONS.map((u) => (
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
