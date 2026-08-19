import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  DESKTOP_CHECKOUT_MEDIA,
  getDesktopCheckoutServerSnapshot,
  isDesktopCheckoutWidth,
} from '../../../components/merchant-pos-preview/use-desktop-checkout-layout';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('merchant POS preview responsive checkout (source/static; not a live viewport)', () => {
  it('treats 767 as mobile and 768 as desktop in the preview-local store', () => {
    assert.equal(isDesktopCheckoutWidth(767), false);
    assert.equal(isDesktopCheckoutWidth(768), true);
    assert.equal(isDesktopCheckoutWidth(820), true);
    assert.equal(DESKTOP_CHECKOUT_MEDIA, '(min-width: 768px)');
    assert.equal(getDesktopCheckoutServerSnapshot(), false);
  });

  it('uses SSR-safe matchMedia and mounts only one interactive cart workspace', () => {
    const helper = read('components/merchant-pos-preview/use-desktop-checkout-layout.ts');
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    const sheet = read('components/merchant-pos-preview/cart-sheet.tsx');
    assert.match(helper, /useSyncExternalStore/);
    assert.match(helper, /matchMedia\('(min-width: 768px)'\)|matchMedia\(DESKTOP_CHECKOUT_MEDIA\)/);
    assert.equal(helper.includes('localStorage'), false);
    assert.equal(helper.includes('sessionStorage'), false);
    assert.equal(helper.includes('fetch('), false);
    assert.match(app, /showCartDock = !isDesktop &&/);
    assert.match(app, /isDesktopCheckout \?/);
    assert.match(app, /aria-label=\{CART_ASIDE_LABEL\}/);
    assert.equal((app.match(/<CartWorkspace/g) ?? []).length, 1);
    assert.equal((sheet.match(/<CartWorkspace/g) ?? []).length, 1);
    assert.match(sheet, /showEditor \? \(/);
    assert.match(sheet, /open = session\.cartOpen && \(confirming \|\| showEditor\)/);
    assert.equal((sheet.match(/<PreviewDialog/g) ?? []).length, 1);
  });

  it('keeps desktop cart sticky, 100dvh, and dialog above the aside', () => {
    const css = read('app/preview/merchant-pos/merchant-pos.module.css');
    assert.match(css, /@media \(min-width: 768px\)/);
    assert.match(css, /\.checkoutSplit\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*3fr\) minmax\(0,\s*2fr\)/);
    assert.match(css, /\.cartAside\s*\{[\s\S]*position:\s*sticky/);
    assert.match(css, /\.cartAside\s*\{[\s\S]*min-width:\s*0/);
    assert.match(css, /\.cartAside\s*\{[\s\S]*max-height:\s*calc\(100dvh/);
    assert.equal(/\.cartAside\s*\{[^}]*position:\s*fixed/.test(css), false);
    assert.match(css, /\.dialogRoot\s*\{[\s\S]*z-index:\s*50/);
    assert.match(css, /@media \(min-width: 768px\)\s*\{\s*\.cartDock\s*\{[\s\S]*display:\s*none/);
    assert.match(css, /\.checkoutSplit \.productGrid\s*\{[\s\S]*repeat\(2,/);
    assert.match(css, /@media \(min-width: 1280px\)[\s\S]*repeat\(3,/);
  });

  it('does not put a cart column on other tabs and does not invent stock math', () => {
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    const workspace = read('components/merchant-pos-preview/cart-workspace.tsx');
    const helper = read('components/merchant-pos-preview/use-desktop-checkout-layout.ts');
    assert.match(app, /isDesktop && session\.tab === 'checkout'/);
    assert.match(app, /<SalesPanel/);
    assert.equal(app.includes('<CartWorkspace') && /tab === 'sales'[\s\S]*<CartWorkspace/.test(app), false);
    assert.equal(workspace.includes("from '@/lib/merchant-pos-preview/fixtures'"), false);
    assert.equal(workspace.includes('PRODUCTS'), false);
    assert.equal(workspace.includes('findVariant'), false);
    assert.equal(workspace.includes('availableQty -'), false);
    assert.equal(helper.includes("from '@/lib/merchant-pos-preview/fixtures'"), false);
    assert.equal(helper.includes('PRODUCTS'), false);
  });
});
