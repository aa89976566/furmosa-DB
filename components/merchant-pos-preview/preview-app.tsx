'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  DEAL_LABEL,
  FIXTURE_ONLY_BADGE,
  ITEM_COUNT_LABEL,
  OPEN_CART,
  PREVIEW_TITLE,
  RECEIPT_LABEL,
  SALE_SUCCESS_SUMMARY,
  STORE_NAME,
} from '@/lib/merchant-pos-preview/copy';
import { formatQty, formatTwd } from '@/lib/merchant-pos-preview/formatters';
import { cartDockState } from '@/lib/merchant-pos-preview/selectors';
import {
  addAllRestockCandidates,
  addRestockLine,
  addSelectedToCart,
  closeRefundConfirm,
  completeDemoSale,
  createSession,
  openCompleteConfirm,
  openRefundConfirm,
  removeCartLine,
  requestDemoRefund,
  removeRestockLine,
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
import {
  applyCheckoutFocusHandoff,
  consumeDesktopCartHadFocus,
  createDesktopCartFocusCaptureState,
  DESKTOP_CART_TITLE_ID,
  isRelatedTargetInsideRegion,
  nextCheckoutFocusIntent,
  nextDesktopCartFocusCapture,
  resolveNullBlurSnapshot,
  type CheckoutFocusIntent,
} from './cart-focus-handoff';
import {
  applyCheckoutLayoutTransition,
  cancelCompleteConfirmForLayout,
  isCheckoutConfirmOpen,
  wouldOpenMobileCartEditor,
} from './cart-layout-transition';
import { CartWorkspace } from './cart-workspace';
import { PreviewBanner } from './preview-banner';
import { PreviewBottomNav } from './bottom-nav';
import { CartSheet } from './cart-sheet';
import { CheckoutPanel } from './checkout-panel';
import { PointsRedemptionPanel } from './more-panel';
import { PreviewAction } from './preview-action';
import { PreviewDisclosure } from './preview-disclosure';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { RestockPanel } from './restock-panel';
import { RefillPanel } from './refill-panel';
import { SalesPanel } from './sales-panel';
import { SettlementPanel } from './settlement-panel';
import { useDesktopCheckoutLayout } from './use-desktop-checkout-layout';

export function MerchantPosPreviewApp() {
  const [session, setSession] = useState<MerchantPosSession>(() => createSession());
  const isDesktop = useDesktopCheckoutLayout();
  const previousDesktopRef = useRef<boolean | null>(null);
  const sessionRef = useRef(session);
  const pendingFocusIntentRef = useRef<CheckoutFocusIntent>('none');
  const desktopCartRef = useRef<HTMLElement | null>(null);
  const desktopCartFocusRef = useRef(createDesktopCartFocusCaptureState());
  const nullBlurTokenRef = useRef(0);
  const openCartCtaRef = useRef<HTMLButtonElement | null>(null);
  sessionRef.current = session;
  const isDesktopCheckout = isDesktop && session.tab === 'checkout';

  if (session.tab !== 'checkout') {
    desktopCartFocusRef.current = nextDesktopCartFocusCapture(desktopCartFocusRef.current, {
      type: 'leave-checkout',
    });
  }

  useLayoutEffect(() => {
    const previous = previousDesktopRef.current;
    previousDesktopRef.current = isDesktop;
    if (previous === null || previous === isDesktop) return;
    const current = sessionRef.current;
    const captured = consumeDesktopCartHadFocus(desktopCartFocusRef.current);
    desktopCartFocusRef.current = captured.next;
    pendingFocusIntentRef.current = nextCheckoutFocusIntent({
      fromDesktop: previous,
      toDesktop: isDesktop,
      editorLinesOpen: wouldOpenMobileCartEditor(current),
      confirmOpen: isCheckoutConfirmOpen(current),
      cartItemCount: current.cart.length,
      desktopCartHadFocus: captured.desktopCartHadFocus,
      reason: 'layout-change',
    });
    setSession((latest) => applyCheckoutLayoutTransition(latest, previous, isDesktop));
  }, [isDesktop]);

  useEffect(() => {
    const intent = pendingFocusIntentRef.current;
    if (intent === 'none') return;
    pendingFocusIntentRef.current = 'none';
    applyCheckoutFocusHandoff(intent, {
      'desktop-cart-region': desktopCartRef.current,
      'mobile-open-cart-cta': openCartCtaRef.current,
      'checkout-heading': document.getElementById('checkout-title'),
    });
  }, [isDesktop, isDesktopCheckout, session.cartOpen, session.cartDialogStep]);
  const latestReceipt = session.demoReceipts[0];
  const dock = cartDockState(session.cart);
  const showCartDock = !isDesktop && session.tab === 'checkout' && session.cart.length > 0;

  const cartHandlers = {
    onQty: (skuId: string, delta: number) => setSession((current) => addCartQty(current, skuId, delta)),
    onQtyInput: (skuId: string, value: string) =>
      setSession((current) => setCartQtyInput(current, skuId, value)),
    onQtyCommit: (skuId: string) => setSession((current) => commitCartQty(current, skuId)),
    onRemove: (skuId: string) => setSession((current) => removeCartLine(current, skuId)),
    onPrice: (skuId: string, value: string) =>
      setSession((current) => setActualUnitPrice(current, skuId, value)),
    onAskComplete: () =>
      setSession((current) => {
        const opened = current.cartOpen ? current : setCartOpen(current, true);
        return openCompleteConfirm(opened);
      }),
  };

  let body;
  if (session.tab === 'checkout') {
    const catalog = (
      <CheckoutPanel
        session={session}
        showInlineCartEmpty={!isDesktopCheckout}
        onQuery={(query) => setSession((current) => setQuery(current, query))}
        onSelectVariant={(productId, skuId) =>
          setSession((current) => selectVariant(current, productId, skuId))
        }
        onAdd={(productId) => setSession((current) => addSelectedToCart(current, productId))}
        onStepQty={(skuId, delta) => setSession((current) => addCartQty(current, skuId, delta))}
        onViewRestock={() => setSession((current) => setTab(current, 'restock'))}
      />
    );
    body = isDesktopCheckout ? (
      <div className={styles.checkoutSplit}>
        <div className={styles.checkoutCatalog}>{catalog}</div>
        <aside
          ref={desktopCartRef}
          className={styles.cartAside}
          tabIndex={-1}
          aria-labelledby={DESKTOP_CART_TITLE_ID}
          onFocusCapture={() => {
            desktopCartFocusRef.current = nextDesktopCartFocusCapture(desktopCartFocusRef.current, {
              type: 'focus-inside',
            });
          }}
          onBlurCapture={(event) => {
            const relatedTargetInside = isRelatedTargetInsideRegion(
              event.currentTarget,
              event.relatedTarget,
            );
            if (relatedTargetInside !== null) {
              desktopCartFocusRef.current = nextDesktopCartFocusCapture(
                desktopCartFocusRef.current,
                { type: 'related-blur', relatedTargetInside },
              );
              return;
            }
            const token = nullBlurTokenRef.current + 1;
            nullBlurTokenRef.current = token;
            const blurRegion = event.currentTarget;
            desktopCartFocusRef.current = nextDesktopCartFocusCapture(desktopCartFocusRef.current, {
              type: 'null-blur',
              token,
            });
            queueMicrotask(() => {
              const snapshot = resolveNullBlurSnapshot({
                blurRegion,
                currentRegion: desktopCartRef.current,
                activeElement: document.activeElement,
              });
              desktopCartFocusRef.current = nextDesktopCartFocusCapture(
                desktopCartFocusRef.current,
                { type: 'resolve-null-blur', token, ...snapshot },
              );
            });
          }}
        >
          <CartWorkspace
            session={session}
            showTitle
            titleId={DESKTOP_CART_TITLE_ID}
            {...cartHandlers}
          />
        </aside>
      </div>
    ) : (
      catalog
    );
  } else if (session.tab === 'sales') {
    body = (
      <SalesPanel
        session={session}
        onAskRefund={(saleId) => setSession((current) => openRefundConfirm(current, saleId))}
        onCancelRefund={() => setSession((current) => closeRefundConfirm(current))}
        onConfirmRefund={(input) =>
          setSession((current) =>
            current.refundConfirmSaleId
              ? requestDemoRefund(current, current.refundConfirmSaleId, input)
              : current,
          )
        }
      />
    );
  } else if (session.tab === 'refill') {
    body = <RefillPanel onAddOn={() => setSession((current) => setTab(current, 'checkout'))} />;
  } else if (session.tab === 'restock') {
    body = (
      <RestockPanel
        session={session}
        onQty={(skuId, value) => setSession((current) => setRestockQty(current, skuId, value))}
        onAddLine={(skuId) => setSession((current) => addRestockLine(current, skuId))}
        onAddAll={() => setSession((current) => addAllRestockCandidates(current))}
        onRemoveLine={(skuId) => setSession((current) => removeRestockLine(current, skuId))}
        onSubmit={() => setSession((current) => submitRestockDraft(current))}
      />
    );
  } else if (session.tab === 'points') {
    body = <PointsRedemptionPanel />;
  } else {
    body = <SettlementPanel />;
  }

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

        <div className={styles.workspaceShell}>
          <PreviewBottomNav
            tab={session.tab}
            onChange={(tab: TabId) => setSession((current) => setTab(current, tab))}
          />

          <main className={`${styles.main} ${showCartDock ? styles.mainWithCartDock : ''} space-y-4`}>
          {session.saleNotice ? (
            <p className={styles.notice} role="status">
              {SALE_SUCCESS_SUMMARY}
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
            <PreviewDisclosure
              summary={`${RECEIPT_LABEL} ${latestReceipt.receiptId} · ${formatQty(latestReceipt.itemCount)} · ${formatTwd(latestReceipt.actualSubtotalTwd)}`}
            >
              <ul className={styles.itemList}>
                {latestReceipt.lines.map((line) => (
                  <li key={line.skuId}>
                    {line.name} {line.specLabel} × {line.qty} · {formatTwd(line.actualLineTwd)}
                  </li>
                ))}
              </ul>
              <p className="mt-2">此為示意收據，不建立訂單、不扣除庫存。</p>
            </PreviewDisclosure>
          ) : null}
            {body}
          </main>
        </div>

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
                  buttonRef={openCartCtaRef}
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
          showEditor={!isDesktop}
          onClose={() => setSession((current) => setCartOpen(current, false))}
          onQty={cartHandlers.onQty}
          onQtyInput={cartHandlers.onQtyInput}
          onQtyCommit={cartHandlers.onQtyCommit}
          onRemove={cartHandlers.onRemove}
          onPrice={cartHandlers.onPrice}
          onAskComplete={cartHandlers.onAskComplete}
          onCancelComplete={() => {
            pendingFocusIntentRef.current = nextCheckoutFocusIntent({
              fromDesktop: isDesktop,
              toDesktop: isDesktop,
              editorLinesOpen: false,
              confirmOpen: true,
              cartItemCount: session.cart.length,
              desktopCartHadFocus: false,
              reason: isDesktop ? 'desktop-confirm-cancel' : 'mobile-confirm-cancel',
            });
            setSession((current) => cancelCompleteConfirmForLayout(current, isDesktop));
          }}
          onComplete={() => setSession((current) => completeDemoSale(current))}
        />
      </div>
    </div>
  );
}
