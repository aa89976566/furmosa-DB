'use client';

import { useMemo, useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  DEAL_LABEL,
  FIXTURE_ONLY_BADGE,
  ITEM_COUNT_LABEL,
  OPEN_CART,
  PREVIEW_TITLE,
  RECEIPT_LABEL,
  STORE_NAME,
} from '@/lib/merchant-pos-preview/copy';
import { formatQty, formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { cartDockState } from '@/lib/merchant-pos-preview/selectors';
import {
  addAllRestockCandidates,
  addRestockLine,
  addSelectedToCart,
  closeCompleteConfirm,
  closeRefundConfirm,
  completeDemoSale,
  createSession,
  openCompleteConfirm,
  openRefundConfirm,
  removeCartLine,
  requestDemoRefund,
  selectVariant,
  setActualUnitPrice,
  setCartOpen,
  setQuery,
  setRestockQty,
  setTab,
  submitRestockDraft,
  addCartQty,
  commitCartQty,
  setCartQtyInput,
} from '@/lib/merchant-pos-preview/session';
import type { MerchantPosSession, TabId } from '@/lib/merchant-pos-preview/types';
import { PreviewBanner } from './preview-banner';
import { PreviewBottomNav } from './bottom-nav';
import { CartSheet } from './cart-sheet';
import { CheckoutPanel } from './checkout-panel';
import { MorePanel } from './more-panel';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { RestockPanel } from './restock-panel';
import { SalesPanel } from './sales-panel';

export function MerchantPosPreviewApp() {
  const [session, setSession] = useState<MerchantPosSession>(() => createSession());
  const latestReceipt = session.demoReceipts[0];
  const dock = cartDockState(session.cart);
  const showCartDock = session.tab === 'checkout' && session.cart.length > 0;

  const body = useMemo(() => {
    if (session.tab === 'checkout') {
      return (
        <CheckoutPanel
          session={session}
          onQuery={(query) => setSession((current) => setQuery(current, query))}
          onSelectVariant={(productId, skuId) =>
            setSession((current) => selectVariant(current, productId, skuId))
          }
          onAdd={(productId) => setSession((current) => addSelectedToCart(current, productId))}
          onViewRestock={() => setSession((current) => setTab(current, 'restock'))}
        />
      );
    }
    if (session.tab === 'sales') {
      return (
        <SalesPanel
          session={session}
          onAskRefund={(saleId) => setSession((current) => openRefundConfirm(current, saleId))}
          onCancelRefund={() => setSession((current) => closeRefundConfirm(current))}
          onConfirmRefund={() =>
            setSession((current) =>
              current.refundConfirmSaleId
                ? requestDemoRefund(current, current.refundConfirmSaleId)
                : current,
            )
          }
        />
      );
    }
    if (session.tab === 'restock') {
      return (
        <RestockPanel
          session={session}
          onQty={(skuId, value) => setSession((current) => setRestockQty(current, skuId, value))}
          onAddLine={(skuId) => setSession((current) => addRestockLine(current, skuId))}
          onAddAll={() => setSession((current) => addAllRestockCandidates(current))}
          onSubmit={() => setSession((current) => submitRestockDraft(current))}
        />
      );
    }
    return <MorePanel />;
  }, [session]);

  return (
    <div className={styles.shell}>
      <div className={styles.frame}>
        <PreviewBanner />
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <p className={styles.headerKicker}>{PREVIEW_TITLE}</p>
            <h1 className={styles.headerTitle}>{STORE_NAME}</h1>
          </div>
          <p className={styles.headerMark}>{FIXTURE_ONLY_BADGE}</p>
        </header>

        <main className={`${styles.main} ${showCartDock ? styles.mainWithCartDock : ''} space-y-4`}>
          {session.saleNotice ? (
            <p className={styles.notice} role="status">
              {session.saleNotice}
            </p>
          ) : null}
          {session.restockNotice ? (
            <p className={styles.notice} role="status">
              {session.restockNotice}
            </p>
          ) : null}
          {session.refundNotice ? (
            <p className={styles.notice} role="status">
              {session.refundNotice}
            </p>
          ) : null}
          {latestReceipt ? (
            <div className={styles.notice}>
              <p className={styles.productName}>
                {RECEIPT_LABEL} {latestReceipt.receiptId}
              </p>
              <p className={`${styles.hint} mt-1`}>{latestReceipt.notice}</p>
            </div>
          ) : null}
          {body}
        </main>

        {showCartDock ? (
          <div className={styles.cartDock}>
            <div className={styles.cartDockInner}>
              <div className={styles.cartDockRow}>
                <p className={styles.cartDockMeta}>
                  {ITEM_COUNT_LABEL} {formatQty(dock.itemCount)}
                  {dock.notice ? ` · ${dock.notice}` : null}
                  {dock.dealTwd == null ? '' : ` · ${DEAL_LABEL} ${formatTwd(dock.dealTwd)}`}
                </p>
                <PreviewAction
                  tone={PREVIEW_ACTION_TONES.openCart}
                  className="min-h-[44px] shrink-0"
                  onClick={() => setSession((current) => setCartOpen(current, true))}
                >
                  {OPEN_CART}
                </PreviewAction>
              </div>
            </div>
          </div>
        ) : null}

        <CartSheet
          session={session}
          onClose={() => setSession((current) => setCartOpen(current, false))}
          onQty={(skuId, delta) => setSession((current) => addCartQty(current, skuId, delta))}
          onQtyInput={(skuId, value) => setSession((current) => setCartQtyInput(current, skuId, value))}
          onQtyCommit={(skuId) => setSession((current) => commitCartQty(current, skuId))}
          onRemove={(skuId) => setSession((current) => removeCartLine(current, skuId))}
          onPrice={(skuId, value) => setSession((current) => setActualUnitPrice(current, skuId, value))}
          onAskComplete={() => setSession((current) => openCompleteConfirm(current))}
          onCancelComplete={() => setSession((current) => closeCompleteConfirm(current))}
          onComplete={() => setSession((current) => completeDemoSale(current))}
        />

        <PreviewBottomNav
          tab={session.tab}
          onChange={(tab: TabId) => setSession((current) => setTab(current, tab))}
        />
      </div>
    </div>
  );
}
