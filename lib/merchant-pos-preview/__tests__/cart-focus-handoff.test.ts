import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  applyCheckoutFocusHandoff,
  consumeDesktopCartHadFocus,
  isRelatedTargetInsideRegion,
  nextCheckoutFocusIntent,
  nextDesktopCartFocusCapture,
  resolveConnectedFocusIntent,
} from '../../../components/merchant-pos-preview/cart-focus-handoff';
import {
  applyCheckoutLayoutTransition,
  isCheckoutConfirmOpen,
  wouldOpenMobileCartEditor,
} from '../../../components/merchant-pos-preview/cart-layout-transition';
import {
  addSelectedToCart,
  createSession,
  openCompleteConfirm,
  selectVariant,
  setActualUnitPrice,
  setCartOpen,
  setCartQtyInput,
  setQuery,
} from '../session';
import type { MerchantPosSession } from '../types';

function seededCart(): MerchantPosSession {
  let session = createSession();
  session = selectVariant(session, 'prod-beef', 'sku-beef-150');
  session = addSelectedToCart(session, 'prod-beef');
  session = addSelectedToCart(session, 'prod-beef');
  session = setQuery(session, '150');
  session = setActualUnitPrice(session, 'sku-beef-150', '188');
  session = setCartOpen(session, true);
  return session;
}

function preservedData(session: MerchantPosSession) {
  return {
    cart: session.cart,
    query: session.query,
    selectedSkuByProductId: session.selectedSkuByProductId,
  };
}

describe('merchant POS preview cart focus handoff (pure contract; not a live DOM proof)', () => {
  it('sets desktop cart region intent when a mobile editor opens onto desktop', () => {
    const mobileOpen = setCartQtyInput(seededCart(), 'sku-beef-150', '');
    assert.equal(wouldOpenMobileCartEditor(mobileOpen), true);
    const before = preservedData(mobileOpen);
    const intent = nextCheckoutFocusIntent({
      fromDesktop: false,
      toDesktop: true,
      editorLinesOpen: wouldOpenMobileCartEditor(mobileOpen),
      confirmOpen: isCheckoutConfirmOpen(mobileOpen),
      cartItemCount: mobileOpen.cart.length,
      desktopCartHadFocus: false,
      reason: 'layout-change',
    });
    assert.equal(intent, 'desktop-cart-region');
    const desktop = applyCheckoutLayoutTransition(mobileOpen, false, true);
    assert.equal(desktop.cart, mobileOpen.cart);
    assert.deepEqual(preservedData(desktop), before);
    assert.equal(desktop.cart[0]?.qtyInput, '');
  });

  it('does not hand off focus when an active confirm resizes', () => {
    let session = seededCart();
    session = openCompleteConfirm(session);
    const before = preservedData(session);
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: false,
        toDesktop: true,
        editorLinesOpen: wouldOpenMobileCartEditor(session),
        confirmOpen: isCheckoutConfirmOpen(session),
        cartItemCount: session.cart.length,
        desktopCartHadFocus: false,
        reason: 'layout-change',
      }),
      'none',
    );
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: true,
        cartItemCount: session.cart.length,
        desktopCartHadFocus: true,
        reason: 'layout-change',
      }),
      'none',
    );
    const resized = applyCheckoutLayoutTransition(session, false, true);
    assert.equal(resized, session);
    assert.deepEqual(preservedData(resized), before);
  });

  it('falls back when the preferred trigger is disconnected', () => {
    let focused = 'none';
    const disconnectedCta = {
      isConnected: false,
      focus() {
        focused = 'cta';
      },
    };
    const heading = {
      isConnected: true,
      focus() {
        focused = 'heading';
      },
    };
    assert.equal(
      resolveConnectedFocusIntent('mobile-open-cart-cta', {
        'desktop-cart-region': null,
        'mobile-open-cart-cta': disconnectedCta,
        'checkout-heading': heading,
      }),
      'checkout-heading',
    );
    assert.equal(
      applyCheckoutFocusHandoff('mobile-open-cart-cta', {
        'desktop-cart-region': null,
        'mobile-open-cart-cta': disconnectedCta,
        'checkout-heading': heading,
      }),
      'checkout-heading',
    );
    assert.equal(focused, 'heading');
    assert.equal(
      applyCheckoutFocusHandoff('desktop-cart-region', {
        'desktop-cart-region': { isConnected: false, focus() { focused = 'aside'; } },
        'mobile-open-cart-cta': null,
        'checkout-heading': heading,
      }),
      'checkout-heading',
    );
  });

  it('uses the desktop-to-mobile target policy without opening a modal', () => {
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: false,
        cartItemCount: 2,
        desktopCartHadFocus: true,
        reason: 'layout-change',
      }),
      'mobile-open-cart-cta',
    );
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: false,
        cartItemCount: 0,
        desktopCartHadFocus: true,
        reason: 'layout-change',
      }),
      'checkout-heading',
    );
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: false,
        cartItemCount: 2,
        desktopCartHadFocus: false,
        reason: 'layout-change',
      }),
      'none',
    );
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: false,
        toDesktop: true,
        editorLinesOpen: false,
        confirmOpen: false,
        cartItemCount: 0,
        desktopCartHadFocus: false,
        reason: 'layout-change',
      }),
      'none',
    );
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: true,
        editorLinesOpen: false,
        confirmOpen: true,
        cartItemCount: 1,
        desktopCartHadFocus: false,
        reason: 'desktop-confirm-cancel',
      }),
      'desktop-cart-region',
    );
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: false,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: true,
        cartItemCount: 1,
        desktopCartHadFocus: false,
        reason: 'mobile-confirm-cancel',
      }),
      'none',
    );
  });

  it('captures cart focus before unmount and docks when the cart still has items', () => {
    let hadFocus = nextDesktopCartFocusCapture(false, { type: 'focus-inside' });
    assert.equal(hadFocus, true);
    hadFocus = nextDesktopCartFocusCapture(hadFocus, {
      type: 'blur',
      relatedTargetInside: null,
    });
    assert.equal(hadFocus, true);
    const captured = consumeDesktopCartHadFocus(hadFocus);
    assert.equal(captured.desktopCartHadFocus, true);
    assert.equal(captured.nextHadFocus, false);
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: false,
        cartItemCount: 2,
        desktopCartHadFocus: captured.desktopCartHadFocus,
        reason: 'layout-change',
      }),
      'mobile-open-cart-cta',
    );
  });

  it('targets the checkout heading when captured cart focus unmounts with an empty cart', () => {
    let hadFocus = nextDesktopCartFocusCapture(false, { type: 'focus-inside' });
    hadFocus = nextDesktopCartFocusCapture(hadFocus, {
      type: 'blur',
      relatedTargetInside: null,
    });
    const captured = consumeDesktopCartHadFocus(hadFocus);
    assert.equal(captured.desktopCartHadFocus, true);
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: false,
        cartItemCount: 0,
        desktopCartHadFocus: captured.desktopCartHadFocus,
        reason: 'layout-change',
      }),
      'checkout-heading',
    );
  });

  it('does not hand off when catalog focus never enters the cart region', () => {
    let hadFocus = false;
    hadFocus = nextDesktopCartFocusCapture(hadFocus, {
      type: 'blur',
      relatedTargetInside: false,
    });
    assert.equal(hadFocus, false);
    const captured = consumeDesktopCartHadFocus(hadFocus);
    assert.equal(captured.desktopCartHadFocus, false);
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: false,
        cartItemCount: 2,
        desktopCartHadFocus: captured.desktopCartHadFocus,
        reason: 'layout-change',
      }),
      'none',
    );
  });

  it('clears the capture flag after consume so a later layout change cannot steal focus', () => {
    const first = consumeDesktopCartHadFocus(
      nextDesktopCartFocusCapture(false, { type: 'focus-inside' }),
    );
    assert.equal(first.desktopCartHadFocus, true);
    const leftover = consumeDesktopCartHadFocus(first.nextHadFocus);
    assert.equal(leftover.desktopCartHadFocus, false);
    assert.equal(leftover.nextHadFocus, false);
    assert.equal(
      nextCheckoutFocusIntent({
        fromDesktop: true,
        toDesktop: false,
        editorLinesOpen: false,
        confirmOpen: false,
        cartItemCount: 2,
        desktopCartHadFocus: leftover.desktopCartHadFocus,
        reason: 'layout-change',
      }),
      'none',
    );
  });

  it('keeps the flag when blur stays inside, and treats a missing relatedTarget as unmount', () => {
    const inside = { id: 'qty' };
    const region = {
      contains(node: EventTarget | null) {
        return node === inside;
      },
    };
    assert.equal(isRelatedTargetInsideRegion(region, null), null);
    assert.equal(isRelatedTargetInsideRegion(region, inside as EventTarget), true);
    assert.equal(isRelatedTargetInsideRegion(region, { id: 'search' } as EventTarget), false);
    assert.equal(
      nextDesktopCartFocusCapture(true, {
        type: 'blur',
        relatedTargetInside: isRelatedTargetInsideRegion(region, inside as EventTarget),
      }),
      true,
    );
    assert.equal(
      nextDesktopCartFocusCapture(true, {
        type: 'blur',
        relatedTargetInside: isRelatedTargetInsideRegion(region, null),
      }),
      true,
    );
  });

  it('wires capture before unmount, consumes the flag, and makes the checkout heading focusable', () => {
    const app = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/preview-app.tsx'),
      'utf8',
    );
    const checkout = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/checkout-panel.tsx'),
      'utf8',
    );
    const css = readFileSync(
      path.join(process.cwd(), 'app/preview/merchant-pos/merchant-pos.module.css'),
      'utf8',
    );
    assert.match(app, /onFocusCapture=/);
    assert.match(app, /onBlurCapture=/);
    assert.match(app, /nextDesktopCartFocusCapture/);
    assert.match(app, /consumeDesktopCartHadFocus/);
    assert.match(app, /isRelatedTargetInsideRegion/);
    assert.equal(app.includes('desktopCartRef.current?.contains(document.activeElement)'), false);
    assert.match(checkout, /id="checkout-title"/);
    assert.match(checkout, /tabIndex=\{-1\}/);
    assert.match(checkout, /styles\.checkoutTitle/);
    assert.match(css, /\.checkoutTitle:focus-visible/);
  });

  it('keeps cart data deep-equal and does not import domain session', () => {
    const mobileOpen = setCartQtyInput(seededCart(), 'sku-beef-150', '');
    const before = preservedData(mobileOpen);
    nextCheckoutFocusIntent({
      fromDesktop: false,
      toDesktop: true,
      editorLinesOpen: true,
      confirmOpen: false,
      cartItemCount: mobileOpen.cart.length,
      desktopCartHadFocus: false,
      reason: 'layout-change',
    });
    const after = applyCheckoutLayoutTransition(mobileOpen, false, true);
    assert.equal(after.cart, mobileOpen.cart);
    assert.deepEqual(preservedData(after), before);
    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/cart-focus-handoff.ts'),
      'utf8',
    );
    assert.equal(src.includes("from '@/lib/merchant-pos-preview/session'"), false);
    assert.equal(src.includes("from '@/lib/merchant-pos-preview/selectors'"), false);
    assert.equal(src.includes("from '@/lib/merchant-pos-preview/fixtures'"), false);
    assert.equal(src.includes('localStorage'), false);
    assert.equal(src.includes('fetch('), false);
  });
});
