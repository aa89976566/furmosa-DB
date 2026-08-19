import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  applyCheckoutLayoutTransition,
  cancelCompleteConfirmForLayout,
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

describe('merchant POS preview cart layout transition (pure; not a live viewport)', () => {
  it('closes a stale mobile lines editor on desktop and stays closed back on mobile', () => {
    const mobileOpen = setCartQtyInput(seededCart(), 'sku-beef-150', '');
    assert.equal(wouldOpenMobileCartEditor(mobileOpen), true);
    const before = preservedData(mobileOpen);

    const desktop = applyCheckoutLayoutTransition(mobileOpen, false, true);
    assert.equal(desktop.cartOpen, false);
    assert.equal(desktop.cartDialogStep, 'lines');
    assert.equal(wouldOpenMobileCartEditor(desktop), false);
    assert.equal(isCheckoutConfirmOpen(desktop), false);
    assert.equal(desktop.cart, mobileOpen.cart);
    assert.deepEqual(preservedData(desktop), before);

    const backToMobile = applyCheckoutLayoutTransition(desktop, true, false);
    assert.equal(backToMobile.cartOpen, false);
    assert.equal(wouldOpenMobileCartEditor(backToMobile), false);
    assert.equal(backToMobile.cart, mobileOpen.cart);
    assert.deepEqual(preservedData(backToMobile), before);
    assert.equal(backToMobile.cart[0]?.qty, 2);
    assert.equal(backToMobile.cart[0]?.qtyInput, '');
    assert.equal(backToMobile.cart[0]?.actualUnitPriceInput, '188');
    assert.equal(backToMobile.query, '150');
    assert.equal(backToMobile.selectedSkuByProductId['prod-beef'], 'sku-beef-150');
  });

  it('returns desktop confirm cancel/Escape to the aside and keeps mobile closed after shrink', () => {
    let session = seededCart();
    session = openCompleteConfirm(session);
    assert.equal(isCheckoutConfirmOpen(session), true);
    const before = preservedData(session);

    const cancelled = cancelCompleteConfirmForLayout(session, true);
    assert.equal(cancelled.cartOpen, false);
    assert.equal(cancelled.cartDialogStep, 'lines');
    assert.equal(isCheckoutConfirmOpen(cancelled), false);
    assert.equal(wouldOpenMobileCartEditor(cancelled), false);
    assert.equal(cancelled.cart, session.cart);
    assert.deepEqual(preservedData(cancelled), before);

    const escaped = cancelCompleteConfirmForLayout(session, true);
    assert.deepEqual(escaped, cancelled);

    const backToMobile = applyCheckoutLayoutTransition(cancelled, true, false);
    assert.equal(backToMobile.cartOpen, false);
    assert.equal(wouldOpenMobileCartEditor(backToMobile), false);
    assert.deepEqual(preservedData(backToMobile), before);
  });

  it('keeps a unique confirm modal across resize and still returns mobile cancel to the editor', () => {
    let session = seededCart();
    session = openCompleteConfirm(session);
    const before = preservedData(session);

    const desktopConfirm = applyCheckoutLayoutTransition(session, false, true);
    assert.equal(isCheckoutConfirmOpen(desktopConfirm), true);
    assert.equal(wouldOpenMobileCartEditor(desktopConfirm), false);
    assert.equal(desktopConfirm, session);

    const mobileConfirm = applyCheckoutLayoutTransition(desktopConfirm, true, false);
    assert.equal(isCheckoutConfirmOpen(mobileConfirm), true);
    assert.equal(mobileConfirm, session);
    assert.deepEqual(preservedData(mobileConfirm), before);

    const mobileCancel = cancelCompleteConfirmForLayout(mobileConfirm, false);
    assert.equal(mobileCancel.cartOpen, true);
    assert.equal(mobileCancel.cartDialogStep, 'lines');
    assert.equal(wouldOpenMobileCartEditor(mobileCancel), true);
    assert.equal(isCheckoutConfirmOpen(mobileCancel), false);
    assert.equal(mobileCancel.cart, session.cart);
    assert.deepEqual(preservedData(mobileCancel), before);
  });

  it('keeps the helper preview-local and free of domain session imports', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/cart-layout-transition.ts'),
      'utf8',
    );
    assert.equal(src.includes("from '@/lib/merchant-pos-preview/session'"), false);
    assert.equal(src.includes("from '@/lib/merchant-pos-preview/selectors'"), false);
    assert.equal(src.includes("from '@/lib/merchant-pos-preview/fixtures'"), false);
    assert.equal(src.includes('localStorage'), false);
    assert.equal(src.includes('fetch('), false);
  });
});
