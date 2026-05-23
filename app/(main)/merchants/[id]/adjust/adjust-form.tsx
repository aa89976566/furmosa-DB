'use client';

import { useMemo, useState } from 'react';
import {
  adjustMerchantStock,
  recordMerchantQuickSale,
} from '@/app/(main)/merchants/[id]/actions';
import { Button } from '@/components/ui/button';
import { calcQuickSalePreview } from '@/lib/merchant-quick-sale-preview';
import { ScanLine, ShoppingBag } from 'lucide-react';

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
  hideProductPicker = false,
  countOnly = false,
  returnTo,
}: {
  merchantId: string;
  products: ProductOption[];
  initialProductId?: string;
  initialMode?: Mode;
  /** 已從庫存表選定商品時，隱藏下方重複的商品下拉 */
  hideProductPicker?: boolean;
  /** 僅盤點（賣出改由庫存表列內操作） */
  countOnly?: boolean;
  /** 盤點完成後導回（例如 /merchants/adjust?merchantId=…） */
  returnTo?: string;
}) {
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const [mode, setMode] = useState<Mode>(
    countOnly ? 'count' : initialMode === 'sold' || initialMode === 'count' ? initialMode : 'count',
  );
  const [productId, setProductId] = useState(initialProductId ?? '');
  const initialProduct = initialProductId ? productMap.get(initialProductId) : undefined;
  const [value, setValue] = useState<number>(() => {
    if (!initialProduct) return 0;
    if (initialMode === 'sold') return 1;
    if (initialMode === 'count' || !initialMode) return initialProduct.currentStock;
    return 0;
  });

  const product = productId ? productMap.get(productId) : undefined;
  const action = mode === 'count' ? adjustMerchantStock : recordMerchantQuickSale;

  const preview =
    mode === 'sold' && product && value > 0
      ? calcQuickSalePreview(product, value)
      : null;

  const countDiff =
    mode === 'count' && product && Number.isFinite(value)
      ? value - product.currentStock
      : null;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="merchantId" value={merchantId} />
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      {!countOnly && (
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
      )}

      {hideProductPicker && product && mode === 'sold' ? (
        <input type="hidden" name="productId" value={productId} />
      ) : (
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
              const id = e.target.value;
              setProductId(id);
              const p = id ? productMap.get(id) : undefined;
              if (!p) {
                setValue(0);
                return;
              }
              setValue(mode === 'count' ? p.currentStock : Math.min(1, p.currentStock));
            }}
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
          {product && mode === 'count' && (
            <p className="text-xs text-muted-foreground">系統現存 {product.currentStock} 件</p>
          )}
        </div>
      )}

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
            填「現場數到的最終數量」。若比系統少（例如 15 → 3），差額會自動記為賣出並納入月結。
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
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="quantity"
              name="quantity"
              type="number"
              min={1}
              max={product?.currentStock ?? undefined}
              step={1}
              required
              value={value || ''}
              onChange={(e) => setValue(Number(e.target.value))}
              className="block min-w-[120px] flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="0"
            />
            {product && product.currentStock > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValue(product.currentStock)}
              >
                全部賣出（{product.currentStock}）
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            店家回報賣了多少件。輸入後下方即時結算抽成與公司實收，送出後扣減庫存並寫入月結用的銷售流水。
          </p>
          {product && !product.commissionMode && (
            <p className="text-xs text-warning">
              此商品尚未設定分潤規則，店家抽成以 0 計算。
            </p>
          )}
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
