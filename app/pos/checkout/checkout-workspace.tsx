'use client';

import { useMemo, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Minus, Plus, Search, ShoppingCart } from 'lucide-react';
import { completeCheckoutAction, type CheckoutState } from './actions';
import type { CheckoutCatalogItem } from '@/lib/pos/checkout-service';

const initialState: CheckoutState = {};

function money(value: number) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    maximumFractionDigits: 0,
  }).format(value);
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="min-h-[52px] w-full rounded-xl bg-[#191919] px-5 text-base font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#d6d3d1]"
    >
      {pending ? '正在完成結帳…' : '確認收款並完成銷售'}
    </button>
  );
}

export function CheckoutWorkspace({ products }: { products: CheckoutCatalogItem[] }) {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [state, action] = useFormState(completeCheckoutAction, initialState);

  const productByKey = useMemo(
    () => new Map(products.map((product) => [product.key, product])),
    [products],
  );
  const visible = products.filter((product) =>
    `${product.name} ${product.specLabel} ${product.sku}`
      .toLocaleLowerCase('zh-TW')
      .includes(query.trim().toLocaleLowerCase('zh-TW')),
  );
  const lines = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([key, quantity]) => ({ product: productByKey.get(key)!, quantity }))
    .filter((line) => line.product);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const total = lines.reduce((sum, line) => sum + line.product.unitPrice * line.quantity, 0);

  function changeQuantity(product: CheckoutCatalogItem, delta: number) {
    setCart((current) => {
      const next = Math.max(0, Math.min(product.stock, (current[product.key] ?? 0) + delta));
      return { ...current, [product.key]: next };
    });
  }

  const cartPayload = JSON.stringify(
    lines.map(({ product, quantity }) => ({
      productId: product.productId,
      tierId: product.tierId,
      quantity,
    })),
  );

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 border-b border-[#e7e5e4] pb-5">
        <p className="text-sm text-muted-foreground">門市收銀</p>
        <h1 className="mt-1 text-2xl font-semibold">建立銷售</h1>
        <p className="mt-1 text-sm text-muted-foreground">選擇商品與數量，確認收款後一次完成訂單與扣庫存。</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="products-title">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="products-title" className="text-base font-semibold">商品</h2>
              <p className="text-sm text-muted-foreground">只顯示本店有庫存的規格</p>
            </div>
            <span className="text-sm text-muted-foreground">{visible.length} 項</span>
          </div>
          <label className="mb-4 flex min-h-[48px] items-center gap-3 rounded-xl border border-[#d6d3d1] bg-white px-4 focus-within:border-[#191919]">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">搜尋商品</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋商品、規格或貨號"
              className="w-full bg-transparent text-base outline-none placeholder:text-[#a8a29e]"
            />
          </label>

          {visible.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {visible.map((product) => {
                const quantity = cart[product.key] ?? 0;
                return (
                  <article key={product.key} className="flex min-h-[190px] flex-col rounded-2xl border border-[#e7e5e4] bg-white p-4 shadow-sm">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold leading-6">{product.name}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">{product.specLabel}</p>
                        </div>
                        <p className="shrink-0 font-semibold">{money(product.unitPrice)}</p>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">庫存 {product.stock} 件 · {product.sku}</p>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-[#eee] pt-4">
                      <span className="text-sm font-medium">數量</span>
                      <div className="flex items-center gap-3" aria-label={`${product.name}數量`}>
                        <button type="button" onClick={() => changeQuantity(product, -1)} disabled={quantity === 0} className="grid h-10 w-10 place-items-center rounded-xl border border-[#d6d3d1] bg-white disabled:opacity-35" aria-label="減少">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-7 text-center text-lg font-semibold tabular-nums">{quantity}</span>
                        <button type="button" onClick={() => changeQuantity(product, 1)} disabled={quantity >= product.stock} className="grid h-10 w-10 place-items-center rounded-xl bg-[#191919] text-white disabled:bg-[#d6d3d1]" aria-label="增加">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[#d6d3d1] bg-white px-5 py-12 text-center text-sm text-muted-foreground">
              找不到符合的商品。
            </div>
          )}
        </section>

        <aside className="xl:sticky xl:top-6 xl:self-start" aria-labelledby="cart-title">
          <form action={action} className="overflow-hidden rounded-2xl border border-[#e7e5e4] bg-white shadow-sm">
            <input type="hidden" name="cart" value={cartPayload} />
            <div className="flex items-center justify-between border-b border-[#e7e5e4] p-5">
              <div className="flex items-center gap-3">
                <ShoppingCart className="h-5 w-5" />
                <h2 id="cart-title" className="text-lg font-semibold">本次銷售</h2>
              </div>
              <span className="rounded-full bg-[#f2f2f2] px-3 py-1 text-sm">{itemCount} 件</span>
            </div>

            <div className="max-h-[45vh] overflow-y-auto p-5">
              {lines.length > 0 ? (
                <ul className="divide-y divide-[#eee]">
                  {lines.map(({ product, quantity }) => (
                    <li key={product.key} className="flex items-start justify-between gap-4 py-3 first:pt-0">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.specLabel} × {quantity}</p>
                      </div>
                      <p className="shrink-0 font-medium">{money(product.unitPrice * quantity)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-10 text-center">
                  <ShoppingCart className="mx-auto h-8 w-8 text-[#a8a29e]" />
                  <p className="mt-3 font-medium">尚未加入商品</p>
                  <p className="mt-1 text-sm text-muted-foreground">使用商品卡片的＋加入數量</p>
                </div>
              )}
            </div>

            <div className="border-t border-[#e7e5e4] bg-[#fafafa] p-5">
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">門市應收</p>
                  <p className="text-xs text-muted-foreground">確認收到款項後再完成</p>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{money(total)}</p>
              </div>
              {state.error ? <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</p> : null}
              <SubmitButton disabled={lines.length === 0} />
            </div>
          </form>
        </aside>
      </div>
    </div>
  );
}
