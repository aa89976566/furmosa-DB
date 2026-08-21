import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { GROOMING_ENTRY_TITLE, GROOMING_ENTRY_CTA } from '../copy';

describe('merchant POS preview grooming voucher entry', () => {
  it('keeps point redemption inside the merchant POS preview without an auth redirect', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/more-panel.tsx'),
      'utf8',
    );
    const types = readFileSync(path.join(process.cwd(), 'lib/merchant-pos-preview/types.ts'), 'utf8');
    const fixtures = readFileSync(path.join(process.cwd(), 'lib/merchant-pos-preview/fixtures.ts'), 'utf8');
    const validators = readFileSync(
      path.join(process.cwd(), 'lib/merchant-pos-preview/validators.ts'),
      'utf8',
    );
    assert.match(src, /PreviewDialog/);
    assert.match(src, /presentation="drawer"/);
    assert.equal(src.includes('PreviewActionLink'), false);
    assert.equal(src.includes('/preview/grooming-voucher'), false);
    assert.equal(GROOMING_ENTRY_CTA, '輸入美容券碼');
    assert.equal(GROOMING_ENTRY_TITLE, '美容服務券核銷');
    assert.equal(src.includes('查看核銷規則'), false);
    assert.equal(src.includes('PreviewDisclosure'), false);
    assert.equal(src.includes('商品折價券'), false);
    assert.equal(src.includes('豬窩'), false);
    assert.equal(types.includes('VoucherFaceTier'), false);
    assert.equal(fixtures.includes('VOUCHER_FACE_BY_TIER'), false);
    assert.equal(validators.includes('serviceTotalExceedsFace'), false);
    assert.match(src, /preview-coupon-code/);
    assert.match(src, /preview-service-total/);
    assert.match(src, /美容服務已完成/);
    assert.match(src, /parsePreviewCouponCode/);
  });
});
