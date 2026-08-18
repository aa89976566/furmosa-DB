'use client';

import { useMemo, useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
        <header className="flex items-start justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {PREVIEW_TITLE}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-navy">{STORE_NAME}</h1>
          </div>
          <Badge variant="outline">{FIXTURE_ONLY_BADGE}</Badge>
        </header>

        <main className={`${styles.main} ${showCartDock ? styles.mainWithCartDock : ''} space-y-4`}>
          {session.saleNotice ? (
            <Card>
              <CardContent className="p-4 text-sm" role="status">
                {session.saleNotice}
              </CardContent>
            </Card>
          ) : null}
          {session.restockNotice ? (
            <Card>
              <CardContent className="p-4 text-sm" role="status">
                {session.restockNotice}
              </CardContent>
            </Card>
          ) : null}
          {session.refundNotice ? (
            <Card>
              <CardContent className="p-4 text-sm" role="status">
                {session.refundNotice}
              </CardContent>
            </Card>
          ) : null}
          {latestReceipt ? (
            <Card>
              <CardContent className="space-y-1 p-4 text-sm">
                <p className="font-medium text-navy">
                  {RECEIPT_LABEL} {latestReceipt.receiptId}
                </p>
                <p>{latestReceipt.notice}</p>
              </CardContent>
            </Card>
          ) : null}
          {body}
        </main>

        {showCartDock ? (
          <div className={styles.cartDock}>
            <div className={`${styles.cartDockInner} border-t border-border/80 bg-card/95 p-3 shadow-card backdrop-blur`}>
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 text-sm font-medium text-navy">
                  {ITEM_COUNT_LABEL} {formatQty(dock.itemCount)}
                  {dock.notice ? ` · ${dock.notice}` : null}
                  {dock.dealTwd == null ? '' : ` · ${DEAL_LABEL} ${formatTwd(dock.dealTwd)}`}
                </p>
                <Button
                  type="button"
                  className="min-h-[44px] shrink-0"
                  onClick={() => setSession((current) => setCartOpen(current, true))}
                >
                  {OPEN_CART}
                </Button>
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
