import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  PREVIEW_ACTION_TONES,
  type PreviewActionTone,
} from '../../../components/merchant-pos-preview/preview-action-matrix';
import {
  COMPLETE_SALE_CONFIRM_BODY,
  PREVIEW_BANNER_PRIMARY,
  PREVIEW_BANNER_SECONDARY,
  SALE_SUCCESS,
} from '../copy';

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8');
}

describe('merchant POS preview visual contract (source/static; not a live viewport)', () => {
  it('keeps an explicit action tone matrix instead of guessing from button text', () => {
    const expected: Record<string, PreviewActionTone> = {
      addToCart: 'primary',
      viewRestock: 'secondary',
      openCart: 'primary',
      completeSalePreview: 'primary',
      completeSaleConfirm: 'primary',
      completeSaleCancel: 'secondary',
      cartQtyStep: 'quiet',
      removeCartLine: 'danger',
      dialogClose: 'secondary',
      requestRefund: 'secondary',
      refundConfirm: 'primary',
      refundCancel: 'secondary',
      addRestockLine: 'primary',
      addAllRestock: 'secondary',
      submitRestock: 'primary',
      openGroomingVoucher: 'primary',
    };
    assert.deepEqual(PREVIEW_ACTION_TONES, expected);

    const checkout = read('components/merchant-pos-preview/checkout-panel.tsx');
    const cart = read('components/merchant-pos-preview/cart-workspace.tsx');
    const sheet = read('components/merchant-pos-preview/cart-sheet.tsx');
    const sales = read('components/merchant-pos-preview/sales-panel.tsx');
    const restock = read('components/merchant-pos-preview/restock-panel.tsx');
    const more = read('components/merchant-pos-preview/more-panel.tsx');
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    const dialog = read('components/merchant-pos-preview/preview-dialog.tsx');

    assert.match(checkout, /CatalogQuantityStepper/);
    assert.match(checkout, /tone=\{PREVIEW_ACTION_TONES\.viewRestock\}/);
    assert.match(checkout, /selected=\{pressed\}/);
    assert.match(checkout, /soldOut=\{soldOut\}/);
    assert.match(app, /tone=\{PREVIEW_ACTION_TONES\.openCart\}/);
    assert.match(cart, /tone=\{PREVIEW_ACTION_TONES\.completeSalePreview\}/);
    assert.match(sheet, /tone=\{PREVIEW_ACTION_TONES\.completeSaleConfirm\}/);
    assert.match(sheet, /tone=\{PREVIEW_ACTION_TONES\.completeSaleCancel\}/);
    assert.match(cart, /tone=\{PREVIEW_ACTION_TONES\.cartQtyStep\}/);
    assert.match(cart, /tone=\{PREVIEW_ACTION_TONES\.removeCartLine\}/);
    assert.match(dialog, /tone=\{PREVIEW_ACTION_TONES\.dialogClose\}/);
    assert.match(sales, /tone=\{PREVIEW_ACTION_TONES\.requestRefund\}/);
    assert.match(sales, /tone=\{PREVIEW_ACTION_TONES\.refundConfirm\}/);
    assert.match(sales, /tone=\{PREVIEW_ACTION_TONES\.refundCancel\}/);
    assert.match(restock, /tone=\{PREVIEW_ACTION_TONES\.addRestockLine\}/);
    assert.match(restock, /tone=\{PREVIEW_ACTION_TONES\.addAllRestock\}/);
    assert.match(restock, /tone=\{PREVIEW_ACTION_TONES\.submitRestock\}/);
    assert.match(more, /tone=\{PREVIEW_ACTION_TONES\.openGroomingVoucher\}/);
    assert.equal(sales.includes('PREVIEW_ACTION_TONES.addToCart'), false);
    assert.equal(sales.includes('PREVIEW_ACTION_TONES.completeSaleConfirm'), false);
  });

  it('defines preview-local black primary, secondary, danger, and disabled styles', () => {
    const css = read('app/preview/merchant-pos/merchant-pos.module.css');
    const action = read('components/merchant-pos-preview/preview-action.tsx');
    assert.match(css, /--preview-bg:\s*#f7f7f5/i);
    assert.match(css, /--preview-surface:\s*#ffffff/i);
    assert.match(css, /--preview-text:\s*#191919/i);
    assert.match(css, /--preview-secondary:\s*#6b6b6b/i);
    assert.match(css, /--preview-border:\s*#e7e5e4/i);
    assert.match(css, /\.actionPrimary\s*\{[\s\S]*background:\s*#191919/i);
    assert.match(css, /\.actionPrimary\s*\{[\s\S]*color:\s*#ffffff/i);
    assert.match(css, /\.actionPrimary:hover[\s\S]*background:\s*#2f2f2f/i);
    assert.match(css, /\.actionPrimary:active[\s\S]*background:\s*#000000/i);
    assert.match(css, /\.actionSecondary\s*\{[\s\S]*background:\s*#ffffff/i);
    assert.match(css, /\.actionSecondary\s*\{[\s\S]*border:\s*1px solid #e7e5e4/i);
    assert.match(css, /\.actionSecondary\s*\{[\s\S]*color:\s*#191919/i);
    assert.match(css, /\.actionDanger\s*\{[\s\S]*background:\s*#c53030/i);
    assert.equal(PREVIEW_ACTION_TONES.requestRefund, 'secondary');
    assert.equal(PREVIEW_ACTION_TONES.refundConfirm, 'primary');
    assert.equal(PREVIEW_ACTION_TONES.removeCartLine, 'danger');
    assert.match(css, /\.action:disabled[\s\S]*background:\s*#e7e5e4/i);
    assert.match(css, /\.action:disabled[\s\S]*color:\s*#9b9a97/i);
    assert.match(css, /\.action:disabled[\s\S]*opacity:\s*1/);
    assert.match(css, /\.action:focus-visible\s*\{[\s\S]*outline:\s*2px solid #191919/i);
    assert.match(css, /\.action:focus-visible\s*\{[\s\S]*outline-offset:\s*2px/);
    assert.match(css, /\.action\s*\{[\s\S]*min-height:\s*44px/);
    assert.match(css, /\.specChip\s*\{[\s\S]*background:\s*var\(--preview-surface\)|#ffffff/i);
    assert.match(css, /\.specChipSelected\s*\{[\s\S]*background:\s*#191919/i);
    assert.match(action, /disabled=\{disabled\}/);
    assert.match(action, /aria-disabled=\{disabled \|\| undefined\}/);
    assert.equal(css.includes('linear-gradient'), false);
    assert.equal(/font-family:\s*['"]?(Notion|Inter)/i.test(css), false);
  });

  it('keeps restock controls in the same responsive card frame as checkout', () => {
    const css = read('app/preview/merchant-pos/merchant-pos.module.css');
    const restock = read('components/merchant-pos-preview/restock-panel.tsx');
    assert.match(restock, /styles\.restockGrid/);
    assert.match(restock, /styles\.restockCard/);
    assert.match(restock, /styles\.restockControls/);
    assert.equal(PREVIEW_ACTION_TONES.addRestockLine, 'primary');
    assert.match(css, /\.restockControls\s*\{[\s\S]*max-width:\s*26rem/);
    assert.match(css, /\.restockGrid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(css, /@media \(min-width:\s*768px\)[\s\S]*\.restockGrid\s*\{[\s\S]*repeat\(2,/);
    assert.match(css, /@media \(min-width:\s*1280px\)[\s\S]*\.restockGrid\s*\{[\s\S]*repeat\(3,/);
  });

  it('keeps safe-area, fixed layers, 100dvh dialog, and z-index in source CSS', () => {
    const css = read('app/preview/merchant-pos/merchant-pos.module.css');
    const dialog = read('components/merchant-pos-preview/preview-dialog.tsx');
    assert.match(css, /\.bottomNav\s*\{[\s\S]*position:\s*fixed/);
    assert.match(css, /\.bottomNav\s*\{[\s\S]*z-index:\s*40/);
    assert.match(css, /\.cartDock\s*\{[\s\S]*position:\s*fixed/);
    assert.match(css, /\.cartDock\s*\{[\s\S]*z-index:\s*35/);
    assert.match(css, /safe-area-inset-bottom/);
    assert.match(css, /\.dialogRoot\s*\{[\s\S]*z-index:\s*50/);
    assert.match(css, /\.dialogPanel\s*\{[\s\S]*z-index:\s*10/);
    assert.match(css, /\.dialogPanel\s*\{[\s\S]*max-height:\s*calc\(100dvh - 2rem\)/);
    assert.match(css, /\.dialogPanel\s*\{[\s\S]*overflow-y:\s*auto/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(dialog, /styles\.dialogRoot/);
    assert.match(dialog, /styles\.dialogPanel/);
    assert.equal(css.includes('live viewport proof'), true);
  });

  it('keeps preview disclosure copy wired in presentation source', () => {
    const banner = read('components/merchant-pos-preview/preview-banner.tsx');
    const cart = read('components/merchant-pos-preview/cart-sheet.tsx');
    assert.match(banner, /PREVIEW_BANNER_PRIMARY/);
    assert.match(banner, /PREVIEW_BANNER_SECONDARY/);
    assert.match(cart, /COMPLETE_SALE_CONFIRM_BODY/);
    assert.equal(PREVIEW_BANNER_PRIMARY, '操作預覽｜資料不會儲存');
    assert.equal(PREVIEW_BANNER_SECONDARY, '以下為示意商品與訂單，不是正式店家資料');
    assert.match(COMPLETE_SALE_CONFIRM_BODY, /操作預覽，不建立訂單、不扣除庫存/);
    assert.match(SALE_SUCCESS, /這是操作預覽，完成後不會扣減示意庫存；重新整理會重置/);
  });

  it('keeps secondary guidance behind native progressive disclosure', () => {
    const disclosure = read('components/merchant-pos-preview/preview-disclosure.tsx');
    const cart = read('components/merchant-pos-preview/cart-sheet.tsx');
    const refund = read('components/merchant-pos-preview/sales-panel.tsx');
    const settlement = read('components/merchant-pos-preview/settlement-panel.tsx');
    const app = read('components/merchant-pos-preview/preview-app.tsx');
    assert.match(disclosure, /<details/);
    assert.match(disclosure, /<summary/);
    assert.match(cart, /summary="查看操作說明"/);
    assert.match(refund, /summary="查看退款說明"/);
    assert.match(refund, /summary="查看退款明細"/);
    assert.match(settlement, /summary="查看結算明細"/);
    assert.match(app, /<PreviewDisclosure/);
    assert.match(refund, /styles\.actionInline/);
    assert.match(cart, /formatQty\(totals\.itemCount\)/);
    assert.match(cart, /formatTwd\(totals\.actualSubtotalTwd\)/);
  });

  it('does not import global button, card, or badge in preview presenters', () => {
    const files = [
      'components/merchant-pos-preview/preview-app.tsx',
      'components/merchant-pos-preview/checkout-panel.tsx',
      'components/merchant-pos-preview/cart-sheet.tsx',
      'components/merchant-pos-preview/cart-workspace.tsx',
      'components/merchant-pos-preview/cart-layout-transition.ts',
      'components/merchant-pos-preview/cart-focus-handoff.ts',
      'components/merchant-pos-preview/preview-disclosure.tsx',
      'components/merchant-pos-preview/use-desktop-checkout-layout.ts',
      'components/merchant-pos-preview/sales-panel.tsx',
      'components/merchant-pos-preview/restock-panel.tsx',
      'components/merchant-pos-preview/more-panel.tsx',
      'components/merchant-pos-preview/settlement-panel.tsx',
      'components/merchant-pos-preview/preview-dialog.tsx',
      'components/merchant-pos-preview/preview-banner.tsx',
      'components/merchant-pos-preview/bottom-nav.tsx',
      'components/merchant-pos-preview/preview-action.tsx',
      'components/merchant-pos-preview/preview-spec-chip.tsx',
      'components/merchant-pos-preview/catalog-quantity-stepper.tsx',
      'components/merchant-pos-preview/catalog-quantity-stepper-command.ts',
    ];
    for (const file of files) {
      const src = read(file);
      assert.equal(src.includes('@/components/ui/button'), false, file);
      assert.equal(src.includes('@/components/ui/card'), false, file);
      assert.equal(src.includes('@/components/ui/badge'), false, file);
    }
  });
});
