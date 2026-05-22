'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScanLine, ShoppingBag, AlertTriangle } from 'lucide-react';

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  isConsigned: boolean;
  currentStock: number;
  suggestedPrice: number | null;
  commissionMode: string | null;
  commissionValue: number | null;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 }).format(n);

type Mode = 'count' | 'sold';

export function AdjustForm({
  merchantId,
  products,
  initialProductId,
  initialMode,
  countAction,
  saleAction,
}: {
  merchantId: string;
  products: ProductOption[];
  initialProductId?: string;
  initialMode?: Mode;
  countAction: (formData: FormData) => void | Promise<void>;
  saleAction: (formData: FormData) => void | Promise<void>;
}) {
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [mode, setMode] = useState<Mode>(
    initialMode === 'sold' || initialMode === 'count' ? initialMode : 'count',
  );
  const [productId, setProductId] = useState(initialProductId ?? '');
  const [value, setValue] = useState<number>(0);

  const product = productId ? productMap.get(productId) : undefined;
  const action = mode === 'count' ? countAction : saleAction;

  // Sold mode preview
  let preview: { commission: number; revenue: number; afterStock: number; gross: number } | null = null;
  if (mode === 'sold' && product && value > 0) {
    const unitPrice = product.suggestedPrice ?? 0;
    const perUnit =
      product.commissionMode === 'percent'
        ? (unitPrice * (product.commissionValue ?? 0)) / 100
        : product.commissionMode === 'amount'
          ? (product.commissionValue ?? 0)
          : 0;
    const gross = unitPrice * value;
    const commission = perUnit * value;
    preview = {
      commission,
      revenue: gross - commission,
      afterStock: product.currentStock - value,
      gross,
    };
  }

  const countDiff =
    mode === 'count' && product && Number.isFinite(value)
      ? value - product.currentStock
      : null;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="merchantId" value={merchantId} />

      <div className="space-y-2">
        <label className="text-sm font-medium">類型</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('count')}
            className={`flex items-center gap-2 rounded-md border bg-background p-3 text-sm transition ${
              mode === 'count' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-muted/40'
            }`}
          >
            <ScanLine className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">盤點</div>
              <div className="text-xs text-muted-foreground">填現場剩多少</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setMode('sold')}
            className={`flex items-center gap-2 rounded-md border bg-background p-3 text-sm transition ${
              mode === 'sold' ? 'border-primary bg-primary/5 ring-2 ring-primary/30' : 'hover:bg-muted/40'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            <div className="text-left">
              <div className="font-medium">賣出</div>
              <div className="text-xs text-muted-foreground">填這次賣了多少</div>
            </div>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="productId" className="text-sm font-medium">
          商品
        </label>
        <select
          id="productId"
          name="productId"
          required
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            setValue(0);
          }}
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">請選擇商品</option>
          <optgroup label="-- 此店已寄賣 --">
            {products
              .filter((product) => product.isConsigned)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}) — 系統現存 {product.currentStock}
                </option>
              ))}
          </optgroup>
          <optgroup label="-- 其他商品 --">
            {products
              .filter((product) => !product.isConsigned)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku}) — 系統現存 {product.currentStock}
                </option>
              ))}
          </optgroup>
        </select>
        {product && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
            <Badge variant="secondary">系統現存 {product.currentStock}</Badge>
            {product.suggestedPrice && (
              <Badge variant="outline">建議售價 {fmt(product.suggestedPrice)}</Badge>
            )}
            {product.commissionMode && product.commissionValue != null && (
              <Badge variant="info">
                抽成{' '}
                {product.commissionMode === 'percent'
                  ? `${product.commissionValue}%`
                  : fmt(Number(product.commissionValue))}
              </Badge>
            )}
            {!product.commissionMode && (
              <Badge variant="warning">
                <AlertTriangle className="mr-1 h-3 w-3" />
                未設規則：抽成將以 0 計
              </Badge>
            )}
          </div>
        )}
      </div>

      {mode === 'count' ? (
        <div className="space-y-2">
          <label htmlFor="newQuantity" className="text-sm font-medium">
            實際盤點到的數量
          </label>
          <input
            id="newQuantity"
            name="newQuantity"
            type="number"
            min={0}
            step={1}
            required
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            填「現場數到的最終數量」。例如系統說 5 但盤點只有 3，就填 3。
          </p>
          {product && countDiff != null && countDiff !== 0 && (
            <div
              className={`rounded-md border-l-4 p-3 text-sm ${
                countDiff > 0 ? 'border-success bg-success/5 text-success' : 'border-destructive bg-destructive/5 text-destructive'
              }`}
            >
              差異：{countDiff > 0 ? '+' : ''}
              {countDiff} 件（系統 {product.currentStock} → 實際 {value}）
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <label htmlFor="quantity" className="text-sm font-medium">
            這次賣出數量
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            min={1}
            step={1}
            required
            value={value || ''}
            onChange={(e) => setValue(Number(e.target.value))}
            className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            店家回報賣了多少件。系統會依「該店該商品的抽成規則」自動算抽成 / 公司實收，並扣店家庫存。
          </p>
          {preview && product && (
            <div className="grid grid-cols-3 gap-3 rounded-md border bg-muted/40 p-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">銷售總額</div>
                <div className="font-semibold tabular-nums">{fmt(preview.gross)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">店家抽成</div>
                <div className="font-semibold tabular-nums text-warning">
                  {fmt(preview.commission)}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">公司實收</div>
                <div className="font-semibold tabular-nums text-success">
                  {fmt(preview.revenue)}
                </div>
              </div>
              <div className="col-span-3 border-t pt-2 text-xs text-muted-foreground">
                扣完後店家庫存：{product.currentStock} → {preview.afterStock}
                {preview.afterStock < 0 && (
                  <span className="ml-2 text-destructive">⚠ 將變成負庫存，建議先進貨</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="note" className="text-sm font-medium">
          備註（選填）
        </label>
        <input
          id="note"
          name="note"
          type="text"
          placeholder={
            mode === 'count'
              ? '原因：破損 / 失竊 / 漏記 / 退回...'
              : '回報日期、結算月份、客戶...'
          }
          className="block w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit">
          {mode === 'count' ? (
            <>
              <ScanLine className="mr-1 h-4 w-4" />
              確認盤點
            </>
          ) : (
            <>
              <ShoppingBag className="mr-1 h-4 w-4" />
              登記銷售
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
