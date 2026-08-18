import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { canRestoreDialogTrigger, isEscapeKey, nextTabIndex } from '../a11y';

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
    assert.match(dialog, /onCloseRef/);
    assert.match(dialog, /}, \[open\]\)/);
    assert.equal((cart.match(/<PreviewDialog/g) ?? []).length, 1);
    assert.equal(isEscapeKey('Escape'), true);
    assert.equal(isEscapeKey('Esc'), false);
    assert.equal(nextTabIndex(0, 3, false), 1);
    assert.equal(nextTabIndex(0, 3, true), 2);
    assert.equal(canRestoreDialogTrigger({ isConnected: true }), true);
    assert.equal(canRestoreDialogTrigger({ isConnected: false }), false);
  });

  it('source still marks the current tab; this is not a live a11y proof', () => {
    const nav = read('components/merchant-pos-preview/bottom-nav.tsx');
    assert.match(nav, /aria-current=\{current \? 'page' : undefined\}/);
    assert.match(nav, /focus-visible:ring-2/);
  });
});
