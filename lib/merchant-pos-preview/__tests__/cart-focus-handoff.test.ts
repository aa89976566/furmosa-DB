import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  applyCheckoutFocusHandoff,
  consumeDesktopCartHadFocus,
  createDesktopCartFocusCaptureState,
  isRelatedTargetInsideRegion,
  nextCheckoutFocusIntent,
  nextDesktopCartFocusCapture,
  resolveConnectedFocusIntent,
  resolveNullBlurSnapshot,
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

  it('clears a null-related blur when the aside is still connected and activeElement is body', () => {
    const body = { id: 'body' };
    const aside = {
      isConnected: true,
      contains(node: unknown) {
        return node !== body;
      },
    };
    let state = nextDesktopCartFocusCapture(createDesktopCartFocusCaptureState(), {
      type: 'focus-inside',
    });
    state = nextDesktopCartFocusCapture(state, { type: 'null-blur', token: 1 });
    assert.equal(state.hadFocus, true);
    assert.equal(state.pendingNullBlurToken, 1);
    const snapshot = resolveNullBlurSnapshot({
      blurRegion: aside,
      currentRegion: aside,
      activeElement: body as EventTarget,
    });
    assert.equal(snapshot.regionConnected, true);
    assert.equal(snapshot.sameRegion, true);
    assert.equal(snapshot.activeElementInside, false);
    state = nextDesktopCartFocusCapture(state, { type: 'resolve-null-blur', token: 1, ...snapshot });
    assert.equal(state.hadFocus, false);
    assert.equal(state.pendingNullBlurToken, null);
    const captured = consumeDesktopCartHadFocus(state);
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

  it('keeps captured cart focus when a null-related blur is resolved after the region is gone', () => {
    const body = { id: 'body' };
    const goneAside = {
      isConnected: false,
      contains() {
        return false;
      },
    };
    let state = nextDesktopCartFocusCapture(createDesktopCartFocusCaptureState(), {
      type: 'focus-inside',
    });
    state = nextDesktopCartFocusCapture(state, { type: 'null-blur', token: 4 });
    const snapshot = resolveNullBlurSnapshot({
      blurRegion: goneAside,
      currentRegion: null,
      activeElement: body as EventTarget,
    });
    assert.equal(snapshot.regionConnected, false);
    assert.equal(snapshot.sameRegion, false);
    state = nextDesktopCartFocusCapture(state, { type: 'resolve-null-blur', token: 4, ...snapshot });
    assert.equal(state.hadFocus, true);
    const captured = consumeDesktopCartHadFocus(state);
    assert.equal(captured.desktopCartHadFocus, true);
    assert.equal(captured.next.hadFocus, false);
    assert.equal(captured.next.pendingNullBlurToken, null);
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

  it('lets a layout transition consume pending null-blur before a late resolve can clear it', () => {
    let state = nextDesktopCartFocusCapture(createDesktopCartFocusCaptureState(), {
      type: 'focus-inside',
    });
    state = nextDesktopCartFocusCapture(state, { type: 'null-blur', token: 8 });
    const captured = consumeDesktopCartHadFocus(state);
    assert.equal(captured.desktopCartHadFocus, true);
    state = nextDesktopCartFocusCapture(captured.next, {
      type: 'resolve-null-blur',
      token: 8,
      regionConnected: true,
      sameRegion: true,
      activeElementInside: false,
    });
    assert.equal(state.hadFocus, false);
    assert.equal(state.pendingNullBlurToken, null);
    const leftover = consumeDesktopCartHadFocus(state);
    assert.equal(leftover.desktopCartHadFocus, false);
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

  it('does not hand off when catalog focus never enters the cart region', () => {
    const state = nextDesktopCartFocusCapture(createDesktopCartFocusCaptureState(), {
      type: 'related-blur',
      relatedTargetInside: false,
    });
    assert.equal(state.hadFocus, false);
    const captured = consumeDesktopCartHadFocus(state);
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

  it('clears the capture flag and pending token when leaving checkout', () => {
    let state = nextDesktopCartFocusCapture(createDesktopCartFocusCaptureState(), {
      type: 'focus-inside',
    });
    state = nextDesktopCartFocusCapture(state, { type: 'null-blur', token: 3 });
    state = nextDesktopCartFocusCapture(state, { type: 'leave-checkout' });
    assert.equal(state.hadFocus, false);
    assert.equal(state.pendingNullBlurToken, null);
    state = nextDesktopCartFocusCapture(state, {
      type: 'resolve-null-blur',
      token: 3,
      regionConnected: false,
      sameRegion: false,
      activeElementInside: false,
    });
    assert.equal(state.hadFocus, false);
    const leftover = consumeDesktopCartHadFocus(state);
    assert.equal(leftover.desktopCartHadFocus, false);
    assert.equal(leftover.next.hadFocus, false);
    assert.equal(leftover.next.pendingNullBlurToken, null);
  });

  it('clears the capture flag after consume so a later layout change cannot steal focus', () => {
    const first = consumeDesktopCartHadFocus(
      nextDesktopCartFocusCapture(createDesktopCartFocusCaptureState(), { type: 'focus-inside' }),
    );
    assert.equal(first.desktopCartHadFocus, true);
    const leftover = consumeDesktopCartHadFocus(first.next);
    assert.equal(leftover.desktopCartHadFocus, false);
    assert.equal(leftover.next.hadFocus, false);
    assert.equal(leftover.next.pendingNullBlurToken, null);
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

  it('keeps the flag when relatedTarget stays inside, and does not treat a missing relatedTarget as gone', () => {
    const inside = { id: 'qty' };
    const region = {
      isConnected: true,
      contains(node: unknown) {
        return node === inside;
      },
    };
    assert.equal(isRelatedTargetInsideRegion(region, null), null);
    assert.equal(isRelatedTargetInsideRegion(region, inside as EventTarget), true);
    assert.equal(isRelatedTargetInsideRegion(region, { id: 'search' } as EventTarget), false);
    const insideState = nextDesktopCartFocusCapture(
      { hadFocus: true, pendingNullBlurToken: null },
      {
        type: 'related-blur',
        relatedTargetInside: Boolean(isRelatedTargetInsideRegion(region, inside as EventTarget)),
      },
    );
    assert.equal(insideState.hadFocus, true);
    const pending = nextDesktopCartFocusCapture(insideState, { type: 'null-blur', token: 2 });
    assert.equal(pending.hadFocus, true);
    assert.equal(pending.pendingNullBlurToken, 2);
    const stillInside = resolveNullBlurSnapshot({
      blurRegion: region,
      currentRegion: region,
      activeElement: inside as EventTarget,
    });
    assert.equal(stillInside.activeElementInside, true);
    assert.equal(
      nextDesktopCartFocusCapture(pending, { type: 'resolve-null-blur', token: 2, ...stillInside })
        .hadFocus,
      true,
    );
  });

  it('wires deferred null-blur resolution, checkout leave clear, and checkout heading focusability', () => {
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
    const capture = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/cart-focus-handoff.ts'),
      'utf8',
    );
    assert.match(app, /onFocusCapture=/);
    assert.match(app, /onBlurCapture=/);
    assert.match(app, /nextDesktopCartFocusCapture/);
    assert.match(app, /consumeDesktopCartHadFocus/);
    assert.match(app, /isRelatedTargetInsideRegion/);
    assert.match(app, /queueMicrotask/);
    assert.match(app, /useLayoutEffect/);
    assert.match(app, /resolveNullBlurSnapshot/);
    assert.match(app, /leave-checkout/);
    assert.equal(app.includes('desktopCartRef.current?.contains(document.activeElement)'), false);
    assert.equal(/relatedTargetInside:\s*null/.test(capture), false);
    assert.equal(capture.includes("type: 'blur'"), false);
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
