'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { ProductCover } from '@/components/pos/product-cover';
import { InventoryBottomNav, InventorySideNav } from '@/components/pos/inventory-nav';
import { RestockCartProvider, useRestockCart } from '@/components/pos/restock-cart-provider';
import { PosPageHeader } from '@/components/pos/pos-page-header';
import type { PosAccount } from '@/lib/pos/account';
import type { InventoryProduct } from '@/lib/pos/load-inventory';
import {
  filterInventoryItems,
  inventoryStockStatus,
  INVENTORY_GROUPS,
  INVENTORY_LOW_STOCK_THRESHOLD,
  isLowOrSoldOutStock,
  type InventoryGroupId,
  type InventoryTone,
} from '@/lib/pos/inventory-groups';
import { suggestedRestockQty } from '@/lib/pos/stock-status';
import { defaultRestockAddQty } from '@/lib/pos/restock-cart';
import {
  adjustInventoryQuantityAction,
  submitInventoryRestockCartAction,
} from '@/app/pos/stock/actions';

const TONE_PILL: Record<InventoryTone, string> = {
  sold_out: 'bg-red-50 text-red-600',
  low: 'bg-orange-50 text-orange-600',
  ok: 'bg-neutral-100 text-neutral-600',
};

const TONE_TEXT: Record<InventoryTone, string> = {
  sold_out: 'text-red-600',
  low: 'text-orange-600',
  ok: 'text-zinc-900',
};

type ToastState = { text: string; href?: string; hrefLabel?: string };

function showToast(
  setToast: (value: ToastState | null) => void,
  value: ToastState,
) {
  setToast(value);
  window.setTimeout(() => setToast(null), 2600);
}

function QtyStepper({
  value,
  onChange,
  min = 1,
  large = false,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  large?: boolean;
}) {
  const btn = large
    ? 'flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-lg'
    : 'flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-base';
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={btn} aria-label="減少" onClick={() => onChange(Math.max(min, value - 1))}>
        −
      </button>
      <span className={`min-w-8 text-center font-semibold tabular-nums ${large ? 'text-3xl' : 'text-base'}`}>
        {value}
      </span>
      <button type="button" className={btn} aria-label="增加" onClick={() => onChange(value + 1)}>
        ＋
      </button>
    </div>
  );
}

function InventoryWorkspaceInner({
  account,
  initialItems,
  initialLowStock = false,
}: {
  account: PosAccount;
  initialItems: InventoryProduct[];
  initialLowStock?: boolean;
}) {
  const cart = useRestockCart();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<InventoryGroupId | 'all'>('all');
  const [lowStockOnly, setLowStockOnly] = useState(initialLowStock);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [addQty, setAddQty] = useState(1);
  const [adjustQty, setAdjustQty] = useState(0);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [mobilePanel, setMobilePanel] = useState<'detail' | 'cart' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [expandedCartId, setExpandedCartId] = useState<string | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const visible = useMemo(
    () =>
      filterInventoryItems(
        items.map((item) => ({ ...item, group: item.group })),
        { query, group, lowStockOnly, lowStockThreshold: INVENTORY_LOW_STOCK_THRESHOLD },
      ),
    [group, items, lowStockOnly, query],
  );
  const lowCount = items.filter((item) => isLowOrSoldOutStock(item.quantity)).length;
  const selected = items.find((item) => item.productId === selectedId) ?? null;
  const selectedStatus = selected ? inventoryStockStatus(selected.quantity) : null;
  const selectedNeedsRestock = selected ? isLowOrSoldOutStock(selected.quantity) : false;

  useEffect(() => {
    if (!selectedId) return;
    const product = items.find((item) => item.productId === selectedId);
    if (!product) return;
    setRestockOpen(false);
    setAdjustOpen(false);
    setAddQty(defaultRestockAddQty(product.suggestedQty));
    setAdjustQty(product.quantity);
  }, [selectedId]);

  function addProductToCart(product: InventoryProduct, quantity?: number) {
    const qty = quantity ?? defaultRestockAddQty(product.suggestedQty);
    cart.add({
      productId: product.productId,
      name: product.name,
      imageUrl: product.imageUrl,
      quantity: qty,
    });
    showToast(setToast, { text: '已加入補貨單' });
  }

  async function onAdjust() {
    if (!selected) return;
    setAdjusting(true);
    const result = await adjustInventoryQuantityAction(selected.productId, adjustQty);
    setAdjusting(false);
    if (!result.ok) {
      showToast(setToast, { text: result.error });
      return;
    }
    const nextQty = result.quantity ?? adjustQty;
    setItems((prev) =>
      prev.map((item) =>
        item.productId === selected.productId
          ? { ...item, quantity: nextQty, suggestedQty: suggestedRestockQty(nextQty) }
          : item,
      ),
    );
    setAdjustOpen(false);
    showToast(setToast, { text: '庫存已調整' });
  }

  async function onSubmitCart() {
    if (cart.lines.length === 0) return;
    setSubmitting(true);
    const result = await submitInventoryRestockCartAction(
      cart.lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
    );
    setSubmitting(false);
    if (!result.ok) {
      showToast(setToast, { text: result.error });
      return;
    }
    cart.clear();
    setMobilePanel(null);
    showToast(setToast, {
      text: '補貨單已送出',
      href: result.requestId ? `/pos/restock/${result.requestId}` : '/pos/restock/progress',
      hrefLabel: '查看補貨單',
    });
  }

  const restockControlsVisible = selectedNeedsRestock || restockOpen;

  const detail = selected && selectedStatus ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">{selected.name}</h2>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500"
          aria-label="取消選取"
          onClick={() => {
            setSelectedId(null);
            setMobilePanel(null);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 flex gap-4">
        <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
          <ProductCover
            name={selected.name}
            imageUrl={selected.imageUrl}
            imgClassName="h-full w-full object-cover"
            markClassName="text-2xl text-neutral-400"
          />
        </div>
        <div>
          <p className="text-xs text-zinc-500">目前庫存</p>
          <p className={`text-4xl font-semibold tabular-nums ${TONE_TEXT[selectedStatus.tone]}`}>
            {selected.quantity}
          </p>
          <p className={`mt-1 text-sm ${TONE_TEXT[selectedStatus.tone]}`}>{selectedStatus.label}</p>
        </div>
      </div>

      <div className="mt-6">
        {restockControlsVisible ? (
          <div>
            <p className="text-sm font-medium text-zinc-900">
              {selectedNeedsRestock ? '建議補貨' : '補貨數量'}
            </p>
            <div className="mt-3">
              <QtyStepper value={addQty} onChange={setAddQty} large />
            </div>
            <button
              type="button"
              className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white"
              onClick={() => addProductToCart(selected, addQty)}
            >
              加入補貨單
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-900 text-sm font-semibold text-zinc-900"
            onClick={() => {
              setRestockOpen(true);
              setAddQty(1);
            }}
          >
            補貨
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-neutral-200 pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between py-2 text-sm text-zinc-500"
          onClick={() => setAdjustOpen((open) => !open)}
        >
          庫存數量不對？調整
          <ChevronDown className={`h-4 w-4 transition ${adjustOpen ? 'rotate-180' : ''}`} />
        </button>
        {adjustOpen ? (
          <div className="pt-2">
            <p className="text-sm font-medium text-zinc-900">調整庫存</p>
            <p className="mt-1 text-xs text-zinc-500">實際庫存</p>
            <div className="mt-2">
              <QtyStepper
                value={adjustQty}
                min={0}
                onChange={(next) => setAdjustQty(Math.max(0, next))}
                large
              />
            </div>
            <button
              type="button"
              disabled={adjusting}
              className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-900 bg-white text-sm font-semibold text-zinc-900 disabled:opacity-60"
              onClick={() => void onAdjust()}
            >
              {adjusting ? '調整中…' : '確認調整'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : (
    <p className="pt-8 text-sm text-zinc-500">選一個商品查看庫存或補貨</p>
  );

  const cartPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900">
          {cart.itemCount > 0 ? `補貨單 (${cart.itemCount})` : '補貨單'}
        </h2>
        {cart.itemCount > 0 ? (
          <Link href="/pos/restock" className="text-sm text-zinc-500">
            查看全部
          </Link>
        ) : null}
      </div>
      {cart.lines.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">尚未加入商品</p>
      ) : (
        <ul className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
          {cart.lines.map((line) => (
            <li key={line.productId} className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100">
                <ProductCover
                  name={line.name}
                  imageUrl={line.imageUrl}
                  imgClassName="h-full w-full object-cover"
                  markClassName="text-sm text-neutral-400"
                />
              </div>
              <p className="min-w-0 flex-1 truncate text-sm text-zinc-900">{line.name}</p>
              {expandedCartId === line.productId ? (
                <QtyStepper value={line.quantity} onChange={(next) => cart.setQty(line.productId, next)} />
              ) : (
                <button
                  type="button"
                  className="shrink-0 text-sm tabular-nums text-zinc-700"
                  onClick={() => setExpandedCartId(line.productId)}
                >
                  × {line.quantity}
                </button>
              )}
              <button
                type="button"
                className="text-zinc-400"
                aria-label={`移除 ${line.name}`}
                onClick={() => cart.remove(line.productId)}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-neutral-200 pt-3">
        <p className="text-sm text-zinc-600">共 {cart.pieceCount} 件商品</p>
        <button
          type="button"
          disabled={cart.lines.length === 0 || submitting}
          className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-xl border border-zinc-900 bg-white text-sm font-semibold text-zinc-900 disabled:opacity-40"
          onClick={() => void onSubmitCart()}
        >
          {submitting ? '送出中…' : '送出補貨單'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-100 text-zinc-900 md:h-screen md:overflow-hidden">
      <div className="md:flex md:h-full">
        <InventorySideNav account={account} />

        <main className="min-w-0 flex-1 md:flex md:h-full md:flex-col md:overflow-hidden">
          <PosPageHeader
            title="庫存"
            description="查看店裡還有哪些商品、數量夠不夠。"
            account={account}
          />
          <div className="px-4 md:px-6">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋商品、SKU 或關鍵字"
                className="h-12 w-full rounded-full border-0 bg-white pl-10 pr-4 text-sm shadow-sm outline-none ring-1 ring-neutral-200 focus:ring-zinc-400"
              />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {INVENTORY_GROUPS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`min-h-[36px] rounded-full px-4 text-sm font-medium ${
                    group === tab.id ? 'bg-zinc-900 text-white' : 'bg-neutral-200/80 text-zinc-600'
                  }`}
                  onClick={() => setGroup(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
              <button
                type="button"
                className={`ml-auto flex min-h-[36px] items-center gap-2 rounded-full px-4 text-sm font-medium ${
                  lowStockOnly ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-neutral-200'
                }`}
                onClick={() => setLowStockOnly((value) => !value)}
              >
                庫存不足
                <span
                  className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                    lowStockOnly ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'
                  }`}
                >
                  {lowCount}
                </span>
              </button>
            </div>
          </div>

          <div className="mt-4 flex-1 px-4 pb-28 md:overflow-y-auto md:px-6 md:pb-8">
            {visible.length === 0 ? (
              <p className="py-10 text-sm text-zinc-500">沒有符合的商品。</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {visible.map((item) => {
                  const status = inventoryStockStatus(item.quantity);
                  const isSelected = selectedId === item.productId;
                  const plusQuiet = status.tone === 'ok';
                  return (
                    <li key={item.productId} className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(item.productId);
                          setMobilePanel('detail');
                        }}
                        className={`flex h-full w-full flex-col rounded-2xl bg-white p-3 text-left shadow-sm ${
                          isSelected ? 'ring-1 ring-zinc-900' : 'ring-1 ring-transparent'
                        }`}
                      >
                        {isSelected ? (
                          <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
                            <Check className="h-3 w-3" />
                          </span>
                        ) : null}
                        <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-neutral-50">
                          <ProductCover
                            name={item.name}
                            imageUrl={item.imageUrl}
                            imgClassName="h-full w-full object-contain"
                            markClassName="text-2xl text-neutral-300"
                          />
                        </div>
                        <p className="mt-3 truncate font-medium">{item.name}</p>
                        <div className="mt-2 flex items-end justify-between gap-2">
                          <p className="text-sm text-zinc-500">庫存 {item.quantity}</p>
                          <span className={`rounded-full px-2 py-0.5 text-xs ${TONE_PILL[status.tone]}`}>
                            {status.label}
                          </span>
                        </div>
                      </button>
                      {isSelected ? null : (
                        <button
                          type="button"
                          className={`absolute right-2 top-2 z-10 flex h-7 items-center rounded-full px-2 text-xs font-medium ${
                            plusQuiet ? 'bg-neutral-100 text-zinc-400' : 'bg-neutral-100 text-zinc-700'
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            addProductToCart(item);
                          }}
                        >
                          ＋ 補
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-6 text-center text-xs text-zinc-400">共 {visible.length} 項商品</p>
          </div>
        </main>

        <aside className="hidden w-[340px] shrink-0 flex-col border-l border-neutral-200 bg-white md:flex">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{detail}</div>
          <div className="h-[280px] border-t border-neutral-200 px-5 py-4">{cartPanel}</div>
        </aside>
      </div>

      {cart.itemCount > 0 ? (
        <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 px-4 md:hidden">
          <button
            type="button"
            className="flex min-h-[48px] w-full items-center justify-between rounded-2xl bg-zinc-900 px-4 text-sm font-medium text-white shadow-lg"
            onClick={() => setMobilePanel('cart')}
          >
            <span>補貨單 {cart.itemCount} 項</span>
            <span>共 {cart.pieceCount} 件</span>
          </button>
        </div>
      ) : null}

      {mobilePanel ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="關閉"
            onClick={() => setMobilePanel(null)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white px-5 py-5">
            {mobilePanel === 'detail' ? detail : cartPanel}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-8">
          {toast.text}
          {toast.href ? (
            <Link href={toast.href} className="ml-2 underline">
              {toast.hrefLabel}
            </Link>
          ) : null}
        </div>
      ) : null}

      <InventoryBottomNav />
    </div>
  );
}

export function InventoryWorkspace({
  account,
  initialItems,
  initialLowStock = false,
}: {
  account: PosAccount;
  initialItems: InventoryProduct[];
  initialLowStock?: boolean;
}) {
  return (
    <RestockCartProvider>
      <InventoryWorkspaceInner
        account={account}
        initialItems={initialItems}
        initialLowStock={initialLowStock}
      />
    </RestockCartProvider>
  );
}
