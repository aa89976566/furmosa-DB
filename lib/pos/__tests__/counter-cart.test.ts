import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addCartLine,
  cartItemCount,
  cartSubtotal,
  catalogAddDisabled,
  counterLineKey,
  setCartLineQty,
  type CounterCartLine,
} from '@/lib/pos/counter-cart';

const snack = {
  key: counterLineKey('p1', 't1'),
  productId: 'p1',
  tierId: 't1',
  name: '雞肉丁凍乾',
  specLabel: '50g',
  unitPrice: 255,
  stock: 3,
  imageUrl: null,
};

describe('counter cart', () => {
  it('adds until stock and never exceeds it', () => {
    let lines: CounterCartLine[] = [];
    lines = addCartLine(lines, snack, 2);
    lines = addCartLine(lines, snack, 2);
    assert.equal(lines[0]?.qty, 3);
    assert.equal(cartItemCount(lines), 3);
    assert.equal(cartSubtotal(lines), 765);
    assert.equal(catalogAddDisabled(3, 3), true);
  });

  it('removes the line when qty is set to 0', () => {
    const lines = setCartLineQty([ { ...snack, qty: 2 } ], snack.key, 0);
    assert.equal(lines.length, 0);
  });

  it('does not add sold-out SKUs', () => {
    const lines = addCartLine([], { ...snack, stock: 0 }, 1);
    assert.equal(lines.length, 0);
  });
});
