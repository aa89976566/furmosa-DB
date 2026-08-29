'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown, Search } from 'lucide-react';
import { ProductCover } from '@/components/pos/product-cover';
import { PosShell } from '@/components/pos/pos-shell';
import { RestockCartProvider, useRestockCart } from '@/components/pos/restock-cart-provider';
import { PosPageHeader } from '@/components/pos/pos-page-header';
import { FURMOSA_CONTACT } from '@/lib/pos/contact';
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
import {
  inventoryHasActiveFilters,
  inventoryListState,
  inventoryQuantityLabel,
  inventoryRestockSubmitItems,
  inventorySubmitBlockedReason,
  inventorySummaryText,
  shouldQuickAddToRestockCart,
} from '@/lib/pos/inventory-ui';
import { suggestedRestockQty } from '@/lib/pos/stock-status';
import { defaultRestockAddQty } from '@/lib/pos/restock-cart';
import {
  adjustInventoryQuantityAction,
  submitInventoryRestockCartAction,
} from '@/app/pos/stock/actions';

const TONE_PILL: Record<InventoryTone, string> = {
  sold_out: 'bg-red-50 text-red-800',
  low: 'bg-orange-50 text-orange-900',
  ok: 'bg-neutral-100 text-zinc-700',
};

const TONE_TEXT: Record<InventoryTone, string> = {
  sold_out: 'text-red-800',
  low: 'text-orange-900',
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
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  large?: boolean;
  decreaseLabel: string;
  increaseLabel: string;
}) {
  const btn = large
    ? 'flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900'
    : 'flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900';
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className={btn}
        aria-label={decreaseLabel}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <span className={`min-w-8 text-center font-semibold tabular-nums ${large ? 'text-3xl' : 'text-base'}`}>
        {value}
      </span>
      <button
        type="button"
        className={btn}
        aria-label={increaseLabel}
        onClick={() => onChange(value + 1)}
      >
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
  const searchRef = useRef<HTMLInputElement>(null);
  const cartEntryRef = useRef<HTMLButtonElement>(null);
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
  const [addingId, setAddingId] = useState<string | null>(null);

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
  const selectedCartLine = selected
    ? cart.lines.find((line) => line.productId === selected.productId)
    : undefined;
  const filtersActive = inventoryHasActiveFilters({ query, group, lowStockOnly });
  const listState = inventoryListState({
    totalCount: items.length,
    visibleCount: visible.length,
    query,
    group,
    lowStockOnly,
  });
  const submitBlocked = inventorySubmitBlockedReason(cart.itemCount);
  const showDesktopPanel = Boolean(selected || cart.itemCount > 0);

  useEffect(() => {
    if (!selectedId) return;
    const product = items.find((item) => item.productId === selectedId);
    if (!product) return;
    setRestockOpen(false);
    setAdjustOpen(false);
    setAddQty(defaultRestockAddQty(product.suggestedQty));
    setAdjustQty(product.quantity);
  }, [selectedId]);

  function clearFilters() {
    setQuery('');
    setGroup('all');
    setLowStockOnly(false);
    searchRef.current?.focus();
  }

  function closeDetail() {
    setSelectedId(null);
    setMobilePanel((panel) => (panel === 'detail' ? null : panel));
    searchRef.current?.focus();
  }

  function closeMobileCart() {
    setMobilePanel(null);
    (cartEntryRef.current ?? searchRef.current)?.focus();
  }

  function addProductToCart(product: InventoryProduct, quantity?: number) {
    if (addingId === product.productId) return;
    const qty = quantity ?? defaultRestockAddQty(product.suggestedQty);
    setAddingId(product.productId);
    cart.add({
      productId: product.productId,
      name: product.name,
      imageUrl: product.imageUrl,
      quantity: qty,
    });
    showToast(setToast, { text: '已加入補貨單' });
    window.setTimeout(() => setAddingId(null), 700);
  }

  function addFromCard(product: InventoryProduct) {
    const existing = cart.lines.find((line) => line.productId === product.productId);
    if (!shouldQuickAddToRestockCart(existing?.quantity)) {
      showToast(setToast, { text: `已在補貨單，目前 ${existing?.quantity} 件` });
      return;
    }
    addProductToCart(product);
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
    if (cart.lines.length === 0 || submitting) return;
    setSubmitting(true);
    const result = await submitInventoryRestockCartAction(inventoryRestockSubmitItems(cart.lines));
    setSubmitting(false);
    if (!result.ok) {
      showToast(setToast, { text: result.error });
      return;
    }
    cart.clear();
    setMobilePanel(null);
    showToast(setToast, {
      text: '補貨申請已送出',
      href: result.requestId ? `/pos/restock/${result.requestId}` : '/pos/restock/progress',
      hrefLabel: '查看補貨單',
    });
  }

  const restockControlsVisible = selectedNeedsRestock || restockOpen;

  const detail = selected && selectedStatus ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 break-words text-lg font-semibold text-zinc-900">{selected.name}</h2>
        <button
          type="button"
          className="min-h-11 shrink-0 rounded-xl px-3 text-base font-medium text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
          onClick={closeDetail}
        >
          關閉商品資料
        </button>
      </div>
      <div className="mt-4 flex gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-neutral-100">
          <ProductCover
            name={selected.name}
            imageUrl={selected.imageUrl}
            imgClassName="h-full w-full object-cover"
            markClassName="text-2xl text-neutral-400"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">目前庫存</p>
          <p className={`text-4xl font-semibold tabular-nums ${TONE_TEXT[selectedStatus.tone]}`}>
            {selected.quantity}
          </p>
          <p className={`mt-1 text-base font-medium ${TONE_TEXT[selectedStatus.tone]}`}>
            {selectedStatus.label}
          </p>
          <p className="mt-2 break-all text-sm text-zinc-500">編號 {selected.sku}</p>
        </div>
      </div>

      <div className="mt-6">
        {restockControlsVisible ? (
          <div>
            <p className="text-base font-medium text-zinc-900">補貨數量</p>
            <div className="mt-3">
              <QtyStepper
                value={addQty}
                onChange={setAddQty}
                large
                decreaseLabel={`減少 ${selected.name} 的補貨數量`}
                increaseLabel={`增加 ${selected.name} 的補貨數量`}
              />
            </div>
            <button
              type="button"
              disabled={addingId === selected.productId}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:opacity-60"
              onClick={() => addProductToCart(selected, addQty)}
            >
              {addingId === selected.productId ? '加入中…' : '加入補貨單'}
            </button>
            {selectedCartLine ? (
              <p className="mt-2 text-base text-zinc-600">
                已在補貨單，目前 {selectedCartLine.quantity} 件
              </p>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-900 text-base font-semibold text-zinc-900"
            onClick={() => {
              setRestockOpen(true);
              setAddQty(1);
            }}
          >
            加入補貨單
          </button>
        )}
      </div>

      <div className="mt-4 border-t border-neutral-200 pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-between py-2 text-base text-zinc-600"
          onClick={() => setAdjustOpen((open) => !open)}
        >
          庫存數量不對？調整
          <ChevronDown className={`h-4 w-4 transition ${adjustOpen ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {adjustOpen ? (
          <div className="pt-2">
            <p className="text-base font-medium text-zinc-900">調整庫存</p>
            <p className="mt-1 text-sm text-zinc-500">實際庫存</p>
            <div className="mt-2">
              <QtyStepper
                value={adjustQty}
                min={0}
                onChange={(next) => setAdjustQty(Math.max(0, next))}
                large
                decreaseLabel={`減少 ${selected.name} 的店內庫存`}
                increaseLabel={`增加 ${selected.name} 的店內庫存`}
              />
            </div>
            <button
              type="button"
              disabled={adjusting}
              className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-900 bg-white text-base font-semibold text-zinc-900 disabled:opacity-60"
              onClick={() => void onAdjust()}
            >
              {adjusting ? '調整中…' : '確認調整'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  const cartPanel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-900">
          {cart.itemCount > 0 ? `補貨單 · ${cart.itemCount} 項` : '補貨單'}
        </h2>
        {cart.itemCount > 0 ? (
          <Link href="/pos/restock" className="text-base text-zinc-600 underline">
            查看全部
          </Link>
        ) : null}
      </div>
      {cart.lines.length === 0 ? (
        <p className="mt-3 text-base text-zinc-600">先從商品加入補貨單。</p>
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
              <p className="min-w-0 flex-1 break-words text-base text-zinc-900">{line.name}</p>
              <QtyStepper
                value={line.quantity}
                onChange={(next) => cart.setQty(line.productId, next)}
                decreaseLabel={`減少 ${line.name} 的補貨數量`}
                increaseLabel={`增加 ${line.name} 的補貨數量`}
              />
              <button
                type="button"
                className="min-h-11 min-w-11 text-base text-zinc-700"
                onClick={() => cart.remove(line.productId)}
              >
                移除
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 border-t border-neutral-200 pt-3">
        <p className="text-base text-zinc-600">
          {cart.itemCount > 0 ? `共 ${cart.pieceCount} 件商品` : '補貨單還是空的'}
        </p>
        <p className="mt-1 text-sm text-zinc-500">送出後是提出申請，不代表商品已經到貨。</p>
        <button
          type="button"
          disabled={Boolean(submitBlocked) || submitting}
          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-zinc-900 text-base font-semibold text-white disabled:bg-neutral-200 disabled:text-zinc-500"
          onClick={() => void onSubmitCart()}
        >
          {submitting ? '正在送出補貨申請…' : '送出補貨申請'}
        </button>
        {submitBlocked ? (
          <p className="mt-2 text-base text-zinc-600">{submitBlocked}</p>
        ) : null}
      </div>
    </div>
  );

  return (
    <PosShell storeName={account.storeName} account={account} wide>
      <div
        className={`mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-x-hidden ${
          cart.itemCount > 0 ? 'pb-36 md:pb-6' : 'pb-8'
        }`}
      >
        <PosPageHeader title="庫存" description="查看店裡還有哪些商品、數量夠不夠。" />
        <p className="px-4 text-base text-zinc-600 md:px-6">
          {inventorySummaryText({ totalCount: items.length, lowCount })}
        </p>

        <div className="px-4 pt-4 md:px-6">
          <label htmlFor="inventory-search" className="text-base font-medium text-zinc-900">
            搜尋商品
          </label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
            <input
              ref={searchRef}
              id="inventory-search"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              aria-describedby="inventory-search-hint"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="商品名稱、編號或關鍵字"
              className="h-12 w-full rounded-full border-0 bg-white py-2 pl-10 pr-12 text-base shadow-sm outline-none ring-1 ring-neutral-200 focus:ring-2 focus:ring-zinc-900"
            />
            {query ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 min-h-11 -translate-y-1/2 px-2 text-base text-zinc-600"
                onClick={() => {
                  setQuery('');
                  searchRef.current?.focus();
                }}
              >
                清除搜尋
              </button>
            ) : null}
          </div>
          <p id="inventory-search-hint" className="mt-2 text-sm text-zinc-500">
            可搜尋商品名稱、編號（SKU）或關鍵字。
          </p>

          <div className="mt-4">
            <p className="text-sm font-semibold text-zinc-500">商品分類</p>
            <div className="mt-2 -mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:overflow-visible md:px-0">
              <div className="flex w-max gap-2 md:w-full md:flex-wrap">
                {INVENTORY_GROUPS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={group === tab.id}
                    className={`min-h-11 shrink-0 rounded-full px-4 text-base font-medium ${
                      group === tab.id ? 'bg-zinc-900 text-white' : 'bg-neutral-200/80 text-zinc-700'
                    }`}
                    onClick={() => setGroup(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-zinc-500">庫存狀態</p>
            <button
              type="button"
              aria-pressed={lowStockOnly}
              className={`mt-2 flex min-h-11 items-center gap-2 rounded-full px-4 text-base font-medium ${
                lowStockOnly ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 ring-1 ring-neutral-200'
              }`}
              onClick={() => setLowStockOnly((value) => !value)}
            >
              只看庫存不足
              <span
                className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-semibold ${
                  lowStockOnly ? 'bg-white text-zinc-900' : 'bg-zinc-900 text-white'
                }`}
              >
                {lowCount}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-5 flex min-h-0 flex-1 flex-col px-4 md:flex-row md:items-start md:gap-6 md:px-6">
          <div className="min-w-0 flex-1">
            {!selected && cart.itemCount === 0 ? (
              <p className="mb-4 text-base text-zinc-500">點商品可看詳細資料。補貨單是空的，先加入商品再送出。</p>
            ) : null}

            {listState === 'empty-store' ? (
              <div className="rounded-2xl bg-white p-5 text-base text-zinc-700">
                <p className="font-semibold text-zinc-900">目前沒有可管理的商品</p>
                <p className="mt-2">店裡還沒有可在這裡查看的商品。需要時請聯絡匠寵。</p>
                <a className="mt-3 inline-flex min-h-11 items-center text-zinc-900 underline" href={FURMOSA_CONTACT.lineUrl}>
                  聯絡匠寵
                </a>
              </div>
            ) : null}

            {listState === 'no-results' ? (
              <div className="rounded-2xl bg-white p-5 text-base text-zinc-700">
                <p className="font-semibold text-zinc-900">找不到符合條件的商品</p>
                <p className="mt-2 break-words">
                  {query.trim()
                    ? `搜尋「${query.trim()}」沒有結果。`
                    : lowStockOnly
                      ? '目前的庫存不足篩選沒有商品。'
                      : group !== 'all'
                        ? `分類「${INVENTORY_GROUPS.find((tab) => tab.id === group)?.label ?? group}」沒有商品。`
                        : '目前的分類或庫存不足篩選沒有商品。'}
                </p>
                {filtersActive ? (
                  <button
                    type="button"
                    className="mt-4 flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-900 text-base font-semibold"
                    onClick={clearFilters}
                  >
                    清除搜尋或篩選
                  </button>
                ) : null}
              </div>
            ) : null}

            {listState === 'ready' ? (
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((item) => {
                  const status = inventoryStockStatus(item.quantity);
                  const isSelected = selectedId === item.productId;
                  const cartLine = cart.lines.find((line) => line.productId === item.productId);
                  const inCart = Boolean(cartLine);
                  return (
                    <li key={item.productId}>
                      <article
                        className={`flex h-full flex-col rounded-2xl bg-white p-3 shadow-sm ${
                          isSelected ? 'ring-2 ring-zinc-900' : 'ring-1 ring-transparent'
                        }`}
                      >
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`查看 ${item.name} 的庫存資料`}
                          onClick={() => {
                            setSelectedId(item.productId);
                            setMobilePanel('detail');
                          }}
                          className="flex min-h-0 flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
                        >
                          {isSelected ? (
                            <span className="mb-2 text-sm font-medium text-zinc-600">目前查看中</span>
                          ) : null}
                          <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl bg-neutral-50 sm:h-32">
                            <ProductCover
                              name={item.name}
                              imageUrl={item.imageUrl}
                              imgClassName="h-full w-full object-contain"
                              markClassName="text-2xl text-neutral-300"
                            />
                          </div>
                          <p className="mt-3 break-words text-base font-semibold leading-snug">{item.name}</p>
                          <p className="mt-2 text-base text-zinc-700">{inventoryQuantityLabel(item.quantity)}</p>
                          <p className={`mt-2 w-fit rounded-full px-2.5 py-1 text-sm font-medium ${TONE_PILL[status.tone]}`}>
                            {status.label}
                          </p>
                        </button>
                        <button
                          type="button"
                          disabled={addingId === item.productId}
                          aria-label={
                            inCart
                              ? `${item.name} 已加入補貨單，目前 ${cartLine?.quantity} 件`
                              : `加入補貨單：${item.name}`
                          }
                          className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-zinc-900 bg-white px-3 text-base font-semibold text-zinc-900 disabled:opacity-60"
                          onClick={() => addFromCard(item)}
                        >
                          {inCart ? `已加入補貨單 · ${cartLine?.quantity} 件` : '加入補貨單'}
                        </button>
                      </article>
                    </li>
                  );
                })}
              </ul>
            ) : null}

            {filtersActive && listState === 'ready' ? (
              <button
                type="button"
                className="mt-4 text-base text-zinc-600 underline"
                onClick={clearFilters}
              >
                清除搜尋或篩選
              </button>
            ) : null}
          </div>

          {showDesktopPanel ? (
            <aside className="mt-6 hidden w-full shrink-0 md:sticky md:top-4 md:mt-0 md:block md:w-[340px]">
              <div className="space-y-4">
                {detail ? (
                  <div className="rounded-2xl bg-white p-5 shadow-sm">{detail}</div>
                ) : null}
                {cart.itemCount > 0 ? (
                  <div className="rounded-2xl bg-white p-5 shadow-sm">{cartPanel}</div>
                ) : selected ? (
                  <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-base text-zinc-600">
                    補貨單還是空的。加入商品後，補貨申請會顯示在這裡。
                  </p>
                ) : null}
              </div>
            </aside>
          ) : null}
        </div>
      </div>

      {cart.itemCount > 0 ? (
        <div className="fixed inset-x-0 z-30 px-4 md:hidden" style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom) + 0.5rem)' }}>
          <button
            ref={cartEntryRef}
            type="button"
            className="flex min-h-12 w-full items-center justify-between rounded-2xl bg-zinc-900 px-4 text-base font-medium text-white shadow-lg"
            onClick={() => setMobilePanel('cart')}
          >
            <span>補貨單 · {cart.itemCount} 項</span>
            <span>查看並送出</span>
          </button>
        </div>
      ) : null}

      {mobilePanel ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="關閉面板"
            onClick={() => {
              if (mobilePanel === 'detail') closeDetail();
              else closeMobileCart();
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl bg-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {mobilePanel === 'detail' ? detail : cartPanel}
            </div>
            {mobilePanel === 'cart' ? (
              <button
                type="button"
                className="mx-5 mb-4 flex min-h-12 items-center justify-center rounded-xl border border-zinc-900 text-base font-semibold"
                onClick={closeMobileCart}
              >
                關閉補貨單
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[min(24rem,calc(100%-2rem))] -translate-x-1/2 break-words rounded-full bg-zinc-900 px-4 py-2 text-sm text-white shadow-lg md:bottom-8"
        >
          {toast.text}
          {toast.href ? (
            <Link href={toast.href} className="ml-2 underline">
              {toast.hrefLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </PosShell>
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
