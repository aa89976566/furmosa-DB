import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  applyCheckoutFocusHandoff,
  nextCheckoutFocusIntent,
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
