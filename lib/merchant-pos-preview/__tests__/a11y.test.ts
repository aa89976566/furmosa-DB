import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  canRestoreDialogTrigger,
  isEscapeKey,
  nextDialogFocusPlan,
  nextTabIndex,
} from '../a11y';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('merchant POS preview a11y static contract', () => {
  it('source still wires labels; this is not a live a11y proof', () => {
    const checkout = read('components/merchant-pos-preview/checkout-panel.tsx');
    const cart = read('components/merchant-pos-preview/cart-workspace.tsx');
    const restock = read('components/merchant-pos-preview/restock-panel.tsx');
    assert.match(checkout, /htmlFor="product-search"/);
    assert.match(checkout, /id="product-search"/);
    assert.match(cart, /ACTUAL_PRICE_LABEL/);
    assert.match(cart, /htmlFor=\{priceId\}/);
    assert.match(cart, /htmlFor=\{qtyId\}/);
    assert.match(cart, /inputMode="numeric"/);
    assert.match(cart, /aria-describedby=\{result\.qtyError \? qtyErrorId : undefined\}/);
    assert.match(cart, /min-h-\[44px\]/);
    assert.match(cart, /onQtyCommit/);
    assert.match(restock, /htmlFor=\{qtyId\}/);
    assert.match(checkout, /skuAvailability\(/);
    assert.match(checkout, /CatalogQuantityStepper/);
    assert.match(checkout, /nextCatalogStepperCommand/);
    assert.match(checkout, /styles\.productGrid/);
    const stepper = read('components/merchant-pos-preview/catalog-quantity-stepper.tsx');
    assert.match(stepper, /const decreaseLabel = `\$\{DECREASE_QTY\}，\$\{lineContext\}`/);
    assert.match(stepper, /const increaseLabel = `\$\{INCREASE_QTY\}，\$\{lineContext\}`/);
    assert.match(stepper, /aria-label=\{decreaseLabel\}/);
    assert.match(stepper, /aria-label=\{increaseLabel\}/);
    assert.match(stepper, /disabled=\{!controls\.canDecrease\}/);
    assert.match(stepper, /disabled=\{!controls\.canIncrease\}/);
    assert.match(stepper, /committedCartQty/);
    assert.equal(stepper.includes('<input'), false);
    assert.match(checkout, /row\.visibleVariants\.map/);
    assert.equal(checkout.includes('availableQty === 0'), false);
    assert.equal(checkout.includes("role=\"alert\""), false);
    assert.match(cart, /skuAvailability\(/);
    assert.match(cart, /disabled=\{!availability\.canAdd\}/);
  });

  it('gives each cart line plus-minus and remove an accessible name with product and spec', () => {
    const cart = read('components/merchant-pos-preview/cart-workspace.tsx');
    assert.match(cart, /const productName = product\?\.name \?\? ''/);
    assert.match(cart, /const specLabel = result\.variant\?\.specLabel \?\? ''/);
    assert.match(cart, /const lineContext = `\$\{productName\} \$\{specLabel\}`\.trim\(\)/);
    assert.match(cart, /const decreaseLabel = `\$\{DECREASE_QTY\}，\$\{lineContext\}`/);
    assert.match(cart, /const increaseLabel = `\$\{INCREASE_QTY\}，\$\{lineContext\}`/);
    assert.match(cart, /const removeLabel = `\$\{REMOVE_LINE\}，\$\{lineContext\}`/);
    assert.match(cart, /aria-label=\{decreaseLabel\}/);
    assert.match(cart, /aria-label=\{increaseLabel\}/);
    assert.match(cart, /aria-label=\{removeLabel\}/);
    assert.equal(cart.includes('aria-label={DECREASE_QTY}'), false);
    assert.equal(cart.includes('aria-label={INCREASE_QTY}'), false);
    assert.match(cart, /htmlFor=\{qtyId\}[\s\S]*?\{CART_QTY_LABEL\}/);
    assert.match(cart, /const qtyLabel = `\$\{CART_QTY_LABEL\}，\$\{lineContext\}`/);
    assert.match(cart, /aria-label=\{qtyLabel\}/);
  });

  it('source still wires one dialog contract; this is not a live focus proof', () => {
    const dialog = read('components/merchant-pos-preview/preview-dialog.tsx');
    const cart = read('components/merchant-pos-preview/cart-sheet.tsx');
    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /aria-labelledby=\{titleId\}/);
    assert.match(dialog, /isEscapeKey\(event\.key\)/);
    assert.match(dialog, /nextTabIndex\(/);
    assert.match(dialog, /canRestoreDialogTrigger\(/);
    assert.match(dialog, /nextDialogFocusPlan\(/);
    assert.match(dialog, /onCloseRef/);
    assert.match(dialog, /}, \[open, titleId\]\)/);
    assert.match(dialog, /tabIndex=\{-1\}/);
    assert.match(dialog, /data-preview-dialog-title/);
    assert.match(dialog, /styles\.dialogPanel/);
    assert.equal((cart.match(/<PreviewDialog/g) ?? []).length, 1);
    assert.match(cart, /titleId=\{confirming \? 'complete-sale-title' : 'cart-title'\}/);
    assert.match(cart, /onClose=\{confirming \? onCancelComplete : onClose\}/);
    assert.equal(isEscapeKey('Escape'), true);
    assert.equal(isEscapeKey('Esc'), false);
    assert.equal(nextTabIndex(0, 3, false), 1);
    assert.equal(nextTabIndex(0, 3, true), 2);
    assert.equal(canRestoreDialogTrigger({ isConnected: true }), true);
    assert.equal(canRestoreDialogTrigger({ isConnected: false }), false);
  });

  it('keeps the first trigger across step changes and only restores on close', () => {
    const closed = { open: false, titleId: 'cart-title', triggerHeld: false };
    const opened = nextDialogFocusPlan(closed, { open: true, titleId: 'cart-title' });
    assert.deepEqual(opened, {
      captureTrigger: true,
      restoreTrigger: false,
      moveFocusToStep: true,
      triggerHeld: true,
    });

    const sameStep = nextDialogFocusPlan(
      { open: true, titleId: 'cart-title', triggerHeld: true },
      { open: true, titleId: 'cart-title' },
    );
    assert.deepEqual(sameStep, {
      captureTrigger: false,
      restoreTrigger: false,
      moveFocusToStep: false,
      triggerHeld: true,
    });

    const linesToConfirm = nextDialogFocusPlan(
      { open: true, titleId: 'cart-title', triggerHeld: true },
      { open: true, titleId: 'complete-sale-title' },
    );
    assert.deepEqual(linesToConfirm, {
      captureTrigger: false,
      restoreTrigger: false,
      moveFocusToStep: true,
      triggerHeld: true,
    });

    const confirmToLines = nextDialogFocusPlan(
      { open: true, titleId: 'complete-sale-title', triggerHeld: true },
      { open: true, titleId: 'cart-title' },
    );
    assert.deepEqual(confirmToLines, {
      captureTrigger: false,
      restoreTrigger: false,
      moveFocusToStep: true,
      triggerHeld: true,
    });

    const closing = nextDialogFocusPlan(
      { open: true, titleId: 'cart-title', triggerHeld: true },
      { open: false, titleId: 'cart-title' },
    );
    assert.deepEqual(closing, {
      captureTrigger: false,
      restoreTrigger: true,
      moveFocusToStep: false,
      triggerHeld: false,
    });
  });

  it('source still marks the current tab; this is not a live a11y proof', () => {
    const nav = read('components/merchant-pos-preview/bottom-nav.tsx');
    assert.match(nav, /aria-current=\{current \? 'page' : undefined\}/);
    assert.match(nav, /focus-visible:ring-2/);
  });
});
