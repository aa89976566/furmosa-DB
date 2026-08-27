'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import {
  addCartLine,
  cartItemCount,
  cartSubtotal,
  catalogAddDisabled,
  type CounterCartLine,
} from '@/lib/pos/counter-cart';
import { filterCounterItems, type CounterCatalogItem } from '@/lib/pos/counter-catalog-view';
import {
  checkoutCounterSaleAction,
  type CounterCheckoutState,
} from '@/app/pos/actions';
import { CounterTicket } from '@/components/pos/counter-ticket';
import { ProductCover } from '@/components/pos/product-cover';
import styles from './counter.module.css';

type Phase = 'edit' | 'confirm' | 'done';

const initialCheckout: CounterCheckoutState = {};

export function CounterApp({
  storeName,
  items,
  categories,
}: {
  storeName: string;
  items: CounterCatalogItem[];
  categories: { id: string; label: string }[];
}) {
  const [session, setSession] = useState(0);
  return (
    <CounterWorkspace
      key={session}
      storeName={storeName}
      items={items}
      categories={categories}
      onReset={() => setSession((value) => value + 1)}
    />
  );
}

function CounterWorkspace({
  storeName,
  items,
  categories,
  onReset,
}: {
  storeName: string;
  items: CounterCatalogItem[];
  categories: { id: string; label: string }[];
  onReset: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | 'all'>('all');
  const [lines, setLines] = useState<CounterCartLine[]>([]);
  const [phase, setPhase] = useState<Phase>('edit');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [state, formAction] = useFormState(checkoutCounterSaleAction, initialCheckout);

  const visible = useMemo(
    () => filterCounterItems(items, query, category),
    [items, query, category],
  );
  const qtyByKey = useMemo(
    () => new Map(lines.map((line) => [line.key, line.qty])),
    [lines],
  );

  useEffect(() => {
    if (!state.ok) return;
    setPhase('done');
    setLines([]);
    setSheetOpen(true);
    router.refresh();
  }, [state.ok, router]);

  function addItem(item: CounterCatalogItem) {
    setPhase('edit');
    setLines((current) =>
      addCartLine(current, {
        key: item.key,
        productId: item.productId,
        tierId: item.tierId,
        name: item.name,
        specLabel: item.specLabel,
        unitPrice: item.unitPrice,
        stock: item.stock,
        imageUrl: item.imageUrl,
      }),
    );
  }

  const ticket = (
    <CounterTicket
      storeName={storeName}
      lines={lines}
      phase={phase}
      error={state.error ?? null}
      doneTotal={state.total ?? null}
      onChangeLines={(next) => {
        setPhase('edit');
        setLines(next);
      }}
      onAskConfirm={() => setPhase('confirm')}
      onCancelConfirm={() => setPhase('edit')}
      onNewTicket={() => {
        setSheetOpen(false);
        onReset();
      }}
    />
  );

  return (
    <form action={formAction} className={styles.workspace}>
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(
          lines.map((line) => ({
            productId: line.productId,
            tierId: line.tierId,
            qty: line.qty,
          })),
        )}
      />
      <section className={styles.catalog}>
        <div className={styles.top}>
          <div>
            <p className={styles.kicker}>收銀</p>
            <h1 className={styles.heading}>寄賣零食</h1>
          </div>
          <div className={styles.search}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜尋商品"
                className="h-11 rounded-full border-0 bg-card pl-10 shadow-card"
                aria-label="搜尋商品"
              />
            </div>
          </div>
        </div>
        <div className={styles.chips} role="tablist" aria-label="商品分類">
          <button
            type="button"
            className={`${styles.chip} ${category === 'all' ? styles.chipActive : ''}`}
            onClick={() => setCategory('all')}
          >
            全部
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`${styles.chip} ${category === item.id ? styles.chipActive : ''}`}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="mt-10 text-sm text-muted-foreground">
            {items.length === 0
              ? '這間店還沒有可收銀的寄賣商品。'
              : '沒有符合的商品，試試別的分類或關鍵字。'}
          </p>
        ) : (
          <div className={styles.grid}>
            {visible.map((item) => {
              const cartQty = qtyByKey.get(item.key) ?? 0;
              const disabled = catalogAddDisabled(item.stock, cartQty);
              return (
                <article
                  key={item.key}
                  className={`${styles.card} ${item.stock <= 0 ? styles.sold : ''}`}
                >
                  <div className={styles.photo}>
                    <ProductCover
                      name={item.name}
                      imageUrl={item.imageUrl}
                      markClassName={styles.mark}
                    />
                  </div>
                  <div className={styles.body}>
                    <h2 className={styles.name}>{item.name}</h2>
                    <p className={styles.spec}>
                      {item.specLabel ?? item.unit}
                      {item.stock > 0 ? ` · 剩 ${item.stock}` : ' · 售完'}
                    </p>
                    <div className={styles.priceRow}>
                      <span className={styles.price}>{formatCurrency(item.unitPrice)}</span>
                      <button
                        type="button"
                        className={styles.add}
                        disabled={disabled}
                        onClick={() => addItem(item)}
                        aria-label={`加入 ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <aside className={styles.ticket}>
        {ticket}
      </aside>

      <div className={styles.dock}>
        <Button
          type="button"
          className="min-h-[52px] w-full rounded-full text-base shadow-card"
          onClick={() => setSheetOpen(true)}
        >
          本單 {cartItemCount(lines)} 件 · {formatCurrency(cartSubtotal(lines))}
        </Button>
      </div>

      {sheetOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-navy/40"
            aria-label="關閉本單"
            onClick={() => setSheetOpen(false)}
          />
          <div
            role="dialog"
            aria-label="本單"
            className="absolute inset-x-0 bottom-0 h-[78vh] overflow-hidden rounded-t-[28px] bg-card shadow-card"
          >
            {ticket}
          </div>
        </div>
      ) : null}
    </form>
  );
}
