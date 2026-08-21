import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { parsePreviewCouponCode, parsePreviewOldJarSerial } from '../validators';

describe('merchant POS preview redemption flows', () => {
  it('validates the canonical preview coupon-code shape without accepting loose input', () => {
    assert.deepEqual(parsePreviewCouponCode(' furmosa-1234 '), { ok: true, value: 'FURMOSA-1234' });
    for (const invalid of ['', '1234', 'FURMOSA-123', 'FURMOSA-12345', 'FURMOSA-A234']) {
      assert.equal(parsePreviewCouponCode(invalid).ok, false, invalid);
    }
  });

  it('validates old-jar serials as exactly eight digits', () => {
    assert.deepEqual(parsePreviewOldJarSerial('12345678'), { ok: true, value: '12345678' });
    for (const invalid of ['', '1234567', '123456789', '1234ABCD', '12 345678']) {
      assert.equal(parsePreviewOldJarSerial(invalid).ok, false, invalid);
    }
  });

  it('keeps voucher redemption and refill delivery as separate POS sections', () => {
    const points = readFileSync(path.join(process.cwd(), 'components/merchant-pos-preview/more-panel.tsx'), 'utf8');
    const refill = readFileSync(path.join(process.cwd(), 'components/merchant-pos-preview/refill-panel.tsx'), 'utf8');
    const nav = readFileSync(path.join(process.cwd(), 'components/merchant-pos-preview/bottom-nav.tsx'), 'utf8');

    assert.match(nav, /id: 'refill'/);
    assert.match(nav, /id: 'points'/);
    assert.match(points, /美容券碼/);
    assert.match(points, /美容服務金額/);
    assert.match(points, /美容服務已完成/);
    assert.doesNotMatch(points, /舊罐瓶底序號/);
    assert.match(refill, /舊罐瓶底序號/);
    assert.match(refill, /已付款/);
    assert.match(refill, /已保留門市庫存/);
    assert.match(refill, /門市只驗證舊罐/);
    assert.doesNotMatch(refill, /新罐瓶底/);
  });
});
