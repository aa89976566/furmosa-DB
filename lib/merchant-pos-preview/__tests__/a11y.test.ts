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
    const cart = read('components/merchant-pos-preview/cart-sheet.tsx');
    const restock = read('components/merchant-pos-preview/restock-panel.tsx');
    assert.match(checkout, /htmlFor="product-search"/);
    assert.match(checkout, /id="product-search"/);
    assert.match(cart, /ACTUAL_PRICE_LABEL/);
    assert.match(cart, /htmlFor=\{priceId\}/);
    assert.match(restock, /htmlFor=\{qtyId\}/);
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
