import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('merchant POS preview layout static contract', () => {
  it('source keeps overflow and 32rem frame; this is not a live viewport proof', () => {
    const css = read('app/preview/merchant-pos/merchant-pos.module.css');
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    const nav = read('components/merchant-pos-preview/bottom-nav.tsx');
    assert.match(css, /overflow-x:\s*hidden/);
    assert.match(css, /max-width:\s*32rem/);
    assert.match(css, /min-width:\s*0/);
    assert.match(css, /@media \(min-width: 1440px\)/);
    assert.match(css, /\.bottomNav\s*\{[\s\S]*position:\s*fixed/);
    assert.match(css, /\.cartDock\s*\{[\s\S]*position:\s*fixed/);
    assert.match(css, /safe-area-inset-bottom/);
    assert.match(app, /styles\.shell/);
    assert.match(app, /styles\.frame/);
    assert.match(app, /styles\.mainWithCartDock/);
    assert.match(app, /styles\.cartDock/);
    assert.match(nav, /styles\.bottomNav/);
  });

  it('source keeps dialog panel scroll classes; this is not a live viewport proof', () => {
    const css = read('app/preview/merchant-pos/merchant-pos.module.css');
    const dialog = read('components/merchant-pos-preview/preview-dialog.tsx');
    const cart = read('components/merchant-pos-preview/cart-sheet.tsx');
    assert.match(css, /\.dialogPanel\s*\{[\s\S]*max-height:\s*calc\(100dvh - 2rem\)/);
    assert.match(css, /\.dialogPanel\s*\{[\s\S]*overflow-y:\s*auto/);
    assert.match(css, /\.dialogPanel\s*\{[\s\S]*overscroll-behavior:\s*contain/);
    assert.match(css, /\.dialogPanel\s*\{[\s\S]*safe-area-inset-bottom/);
    assert.match(dialog, /styles\.dialogPanel/);
    assert.match(cart, /session\.cart\.map/);
    assert.match(cart, /COMPLETE_SALE/);
    assert.equal(css.includes('live viewport proof'), true);
  });

  it('source still uses 44px touch target classes; this is not a live viewport proof', () => {
    const files = [
      'components/merchant-pos-preview/checkout-panel.tsx',
      'components/merchant-pos-preview/cart-sheet.tsx',
      'components/merchant-pos-preview/restock-panel.tsx',
      'components/merchant-pos-preview/sales-panel.tsx',
      'components/merchant-pos-preview/more-panel.tsx',
      'components/merchant-pos-preview/bottom-nav.tsx',
      'components/merchant-pos-preview/preview-app.tsx',
    ];
    for (const file of files) {
      assert.match(read(file), /min-h-\[44px\]|min-h-\[52px\]/);
    }
  });
});
