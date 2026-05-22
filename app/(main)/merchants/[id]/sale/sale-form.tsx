'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
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

type Item = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  isConsigned: boolean;
  defaultUnit: string;
  priceTiers: ProductTierOption[];
  suggestedPrice: number;
  commissionMode: string | null;
  commissionValue: number | null;
  commissionPerUnit: number;
  companyRevenuePerUnit: number;
};

type Line = {
  productId: string;
  tierId: string;
  quantity: number;
  unitPrice: number;
  weightGrams: number | '';
  unit: string;
};

const UNIT_OPTIONS = ['包', '片', '支', '罐', '盒', '袋', '組', '件'];

const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 })
    .format(n)
    .replace('NT$', 'NT$');

function hasMerchantRule(item: Item) {
  return item.commissionMode != null;
}

function unitPriceForItem(item: Item, tier?: ProductTierOption | null) {
  if (hasMerchantRule(item)) return item.suggestedPrice;
  if (tier) return tier.price;
  return item.suggestedPrice;
}

function weightGramsForTier(tier?: ProductTierOption | null) {
  if (!tier?.weightGrams || tier.weightGrams <= 0) return '';
  return tier.weightGrams;
}

export function SaleForm({ items }: { items: Item[] }) {
  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [lines, setLines] = useState<Line[]>([
    { productId: '', tierId: '', quantity: 1, unitPrice: 0, weightGrams: '', unit: '包' },
  ]);

  function selectProduct(idx: number, productId: string) {
    const item = itemMap.get(productId);
    if (!item) {
      setLines((ls) =>
        ls.map((line, i) =>
          i === idx
            ? { productId: '', tierId: '', quantity: 1, unitPrice: 0, weightGrams: '', unit: '包' }
            : line,
        ),
      );
      return;
    }

    if (item.priceTiers.length > 0) {
      const tier = item.priceTiers[0];
      setLines((ls) =>
        ls.map((line, i) =>
          i === idx
            ? {
                ...line,
                productId,
                tierId: tier.id,
                unitPrice: unitPriceForItem(item, tier),
                weightGrams: weightGramsForTier(tier),
                unit: tier.unit,
              }
            : line,
        ),
      );
      return;
    }

    const detected = parseWeightFromName(item.name);
    setLines((ls) =>
      ls.map((line, i) =>
        i === idx
          ? {
              ...line,
              productId,
              tierId: '',
              unitPrice: item.suggestedPrice,
              weightGrams: detected ?? '',
              unit: item.defaultUnit || '包',
            }
          : line,
      ),
    );
  }

  function selectTier(idx: number, tierId: string) {
    const line = lines[idx];
    const item = itemMap.get(line.productId);
    const tier = item?.priceTiers.find((option) => option.id === tierId);
    if (!item || !tier) return;

    setLines((ls) =>
      ls.map((current, i) =>
        i === idx
          ? {
              ...current,
              tierId,
              unitPrice: unitPriceForItem(item, tier),
              weightGrams: weightGramsForTier(tier),
              unit: tier.unit,
            }
          : current,
      ),
    );
  }

  function update(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function add() {
    setLines((ls) => [
      ...ls,
      { productId: '', tierId: '', quantity: 1, unitPrice: 0, weightGrams: '', unit: '包' },
    ]);
  }

  function remove(idx: number) {
    setLines((ls) => (ls.length === 1 ? ls : ls.filter((_, i) => i !== idx)));
  }

  let total = 0;
  let totalCommission = 0;
  let totalRevenue = 0;
  for (const line of lines) {
    const item = itemMap.get(line.productId);
    if (!item || line.quantity <= 0) continue;
    const gross = line.unitPrice * line.quantity;
    const commission =
      item.commissionMode === 'percent'
        ? (line.unitPrice * (item.commissionValue ?? 0) * line.quantity) / 100
        : (item.commissionValue ?? 0) * line.quantity;
    total += gross;
    totalCommission += commission;
    totalRevenue += gross - commission;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-12 gap-3 px-1 text-xs font-medium text-muted-foreground">
        <div className="col-span-3">商品</div>
        <div className="col-span-3">規格</div>
        <div className="col-span-2 text-right">單價</div>
        <div className="col-span-1 text-right">數量</div>
        <div className="col-span-1 text-center">單位</div>
        <div className="col-span-1 text-right">抽成 / 公司實收</div>
        <div className="col-span-1"></div>
      </div>
      {lines.map((line, idx) => {
        const item = itemMap.get(line.productId);
        const hasTiers = (item?.priceTiers.length ?? 0) > 0;
        const overstock = item && line.quantity > item.stock;
        return (
          <div
            key={idx}
            className="grid grid-cols-12 items-start gap-3 rounded-lg border bg-muted/30 p-3"
          >
            <div className="col-span-3 space-y-1">
              <select
                name="productId"
                required
                value={line.productId}
                onChange={(e) => selectProduct(idx, e.target.value)}
                className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">請選擇商品</option>
                <optgroup label="-- 此店已寄賣 --">
                  {items
                    .filter((product) => product.isConsigned)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku}) — 庫存 {product.stock}
                      </option>
                    ))}
                </optgroup>
                <optgroup label="-- 其他商品 --">
                  {items
                    .filter((product) => !product.isConsigned)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku}) — 庫存 {product.stock}
                      </option>
                    ))}
                </optgroup>
              </select>
              {item && (
                <div className="text-xs text-muted-foreground">
                  顯示：
                  <span className="font-medium text-foreground">
                    {productLabel(
                      item.name,
                      line.weightGrams === '' ? null : Number(line.weightGrams),
                      line.unit,
                    )}
                  </span>
                </div>
              )}
              {item && !item.isConsigned && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  此商品尚未設定此店寄賣規則
                </div>
              )}
              {item && item.commissionMode == null && item.isConsigned && (
                <div className="flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="h-3 w-3" />
                  此店家未設定抽成規則
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
                  {item!.priceTiers.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {variationLabel(tier)}
                      {tier.notes ? ` · ${tier.notes}` : ''}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                  {item ? '無規格' : '請先選商品'}
                </div>
              )}
            </div>
            <div className="col-span-2">
              <input
                name="unitPrice"
                type="number"
                min={0}
                step={1}
                required
                value={line.unitPrice}
                onChange={(e) => update(idx, { unitPrice: Number(e.target.value) })}
                className="block w-full rounded-md border bg-background px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {item && (
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  建議 {fmt(item.suggestedPrice)}
                </div>
              )}
            </div>
            <div className="col-span-1">
              <input
                name="quantity"
                type="number"
                min={1}
                step={1}
                required
                value={line.quantity}
                onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                className="block w-full rounded-md border bg-background px-2 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {item && (
                <div className="mt-1 text-right">
                  <Badge variant={overstock ? 'destructive' : 'secondary'}>庫 {item.stock}</Badge>
                </div>
              )}
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
            <div className="col-span-1 text-right text-sm">
              {item && line.quantity > 0 ? (
                <>
                  <div>
                    抽{' '}
                    <span className="font-mono font-semibold text-warning">
                      {fmt(
                        item.commissionMode === 'percent'
                          ? (line.unitPrice * (item.commissionValue ?? 0) * line.quantity) / 100
                          : (item.commissionValue ?? 0) * line.quantity,
                      )}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    公司{' '}
                    <span className="font-semibold text-success">
                      {fmt(
                        line.unitPrice * line.quantity -
                          (item.commissionMode === 'percent'
                            ? (line.unitPrice * (item.commissionValue ?? 0) * line.quantity) / 100
                            : (item.commissionValue ?? 0) * line.quantity),
                      )}
                    </span>
                  </div>
                </>
              ) : (
                '-'
              )}
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

      <div className="grid grid-cols-3 gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">訂單總額</div>
          <div className="text-lg font-semibold tabular-nums">{fmt(total)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">店家抽成</div>
          <div className="text-lg font-semibold tabular-nums text-warning">{fmt(totalCommission)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">公司實收</div>
          <div className="text-lg font-semibold tabular-nums text-success">{fmt(totalRevenue)}</div>
        </div>
      </div>
    </div>
  );
}
