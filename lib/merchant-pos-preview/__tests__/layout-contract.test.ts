import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('merchant POS preview layout contract', () => {
  it('keeps 360/390/430 from overflowing and 1440 from stretching', () => {
    const css = read('app/preview/merchant-pos/merchant-pos.module.css');
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /max-width:\s*32rem/);
    assert.match(css, /min-width:\s*0/);
    assert.match(css, /@media \(min-width: 1440px\)/);
    assert.match(app, /styles\.shell/);
    assert.match(app, /styles\.frame/);
  });

  it('uses 44px touch targets on primary controls', () => {
    const files = [
      'components/merchant-pos-preview/checkout-panel.tsx',
      'components/merchant-pos-preview/cart-sheet.tsx',
      'components/merchant-pos-preview/restock-panel.tsx',
      'components/merchant-pos-preview/sales-panel.tsx',
      'components/merchant-pos-preview/more-panel.tsx',
      'components/merchant-pos-preview/bottom-nav.tsx',
    ];
    for (const file of files) {
      assert.match(read(file), /min-h-\[44px\]|min-h-\[52px\]/);
    }
  });
});
