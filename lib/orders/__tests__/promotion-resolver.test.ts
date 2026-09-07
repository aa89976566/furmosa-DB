import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shopifySnapshot, stripPromotionCapture, type Snapshot } from '../../shopify/intake-policy';
import {
  PROMOTION_GIFT_VARIANT_ID, PROMOTION_THRESHOLD_CENTS, resolvePromotion,
} from '../promotion-resolver';

const start = '2026-08-27T06:55:00+08:00';
const before = '2026-08-27T06:54:59+08:00';

function snap(overrides: Record<string, unknown> = {}, lines?: Record<string, unknown>[]): Snapshot {
  return shopifySnapshot({
    id: '555', currency: 'TWD', created_at: start, updated_at: '2026-08-27T07:00:00+08:00',
    financial_status: 'paid', subtotal_price: '555.00', total_discounts: '0.00', total_price: '615.00',
    total_shipping_price_set: { shop_money: { amount: '60.00' } },
    line_items: lines ?? [{ sku: 'A', title: '飼料', quantity: 1, price: '555.00', requires_shipping: true }],
    ...overrides,
  });
}

describe('promotion resolver eligibility', () => {
  it('uses pre-discount line subtotals, ignores shipping and paid totals, and caps at one gift', () => {
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '554.99' }])).giftAction, 'ineligible');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '554.99' }])).reason, 'INELIGIBLE_BELOW_THRESHOLD');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '555.00' }])).giftAction, 'add');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '555.01' }])).giftAction, 'add');
    const double = resolvePromotion(snap({}, [{ sku: 'A', quantity: 2, price: '555.00' }]));
    assert.equal(double.giftAction, 'add');
    assert.equal(double.qualifyingCents, 111000);
    const shippingOnly = resolvePromotion(snap({
      total_price: '615.00', subtotal_price: '500.00',
    }, [{ sku: 'A', quantity: 1, price: '500.00' }]));
    assert.equal(shippingOnly.giftAction, 'ineligible');
    const discounted = resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '555.00', total_discount: '100.00' }]));
    assert.equal(discounted.giftAction, 'add');
    assert.equal(discounted.qualifyingCents, PROMOTION_THRESHOLD_CENTS);
  });

  it('counts every paid SKU including paid CK-08, and does not treat paid CK-08 as an existing gift', () => {
    const paidCk = resolvePromotion(snap({}, [{ sku: 'CK-08', variant_id: PROMOTION_GIFT_VARIANT_ID, quantity: 1, price: '555.00' }]));
    assert.equal(paidCk.giftAction, 'add');
    assert.equal(paidCk.existingGiftQuantity, 0);
    const mixed = resolvePromotion(snap({}, [
      { sku: 'B', quantity: 1, price: '300.00' },
      { sku: 'CK-08', quantity: 1, price: '255.00' },
    ]));
    assert.equal(mixed.giftAction, 'add');
    assert.equal(mixed.qualifyingCents, 55500);
  });

  it('respects campaign start, invalid dates at threshold, and does not extra-block old below-threshold orders', () => {
    assert.equal(resolvePromotion(snap({ created_at: before }, [{ sku: 'A', quantity: 1, price: '555.00' }])).reason, 'INELIGIBLE_BEFORE_CAMPAIGN');
    assert.equal(resolvePromotion(snap({ created_at: start }, [{ sku: 'A', quantity: 1, price: '555.00' }])).giftAction, 'add');
    const noDate = shopifySnapshot({
      id: '1', currency: 'TWD', updated_at: '2026-08-30T01:00:00Z',
      line_items: [{ sku: 'A', quantity: 1, price: '555.00' }],
    });
    assert.equal(resolvePromotion(noDate).reason, 'INVALID_DATE');
    const oldCheap = shopifySnapshot({
      id: '1', currency: 'TWD', updated_at: '2026-08-30T01:00:00Z',
      line_items: [{ sku: 'A', quantity: 1, price: '100.10' }],
    });
    assert.equal(resolvePromotion(oldCheap).reason, 'INELIGIBLE_BELOW_THRESHOLD');
    assert.deepEqual(resolvePromotion(oldCheap).issues, []);
  });

  it('fails closed on non-TWD, illegal money, quantity and overflow', () => {
    assert.equal(resolvePromotion(snap({ currency: 'USD' })).reason, 'INVALID_MONEY');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '-1' }])).reason, 'INVALID_MONEY');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '1.001' }])).reason, 'INVALID_MONEY');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 0, price: '555.00' }])).reason, 'INVALID_QUANTITY');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 0.5, price: '555.00' }])).reason, 'INVALID_QUANTITY');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 9007199254740993, price: '1.00' }])).reason, 'INVALID_QUANTITY');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '555.00', total_discount: '600.00' }])).reason, 'INVALID_MONEY');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 1, price: '90071992547410.00' }])).reason, 'INVALID_MONEY');
    assert.equal(resolvePromotion(snap({}, [{ sku: 'A', quantity: 2147483647, price: '999999.00' }])).reason, 'OVERFLOW');
  });

  it('rejects impossible calendar dates at threshold and does not extra-block cheap orders', () => {
    const sept31 = resolvePromotion(snap({ created_at: '2026-09-31T00:00:00+08:00' }, [{ sku: 'A', quantity: 1, price: '555.00' }]));
    assert.equal(sept31.reason, 'INVALID_DATE');
    assert.equal(sept31.giftAction, 'uncertain');
    assert.ok(sept31.issues.some(issue => issue.message.includes('真實日曆')));
    const feb29 = resolvePromotion(snap({ created_at: '2026-02-29T00:00:00+08:00' }, [{ sku: 'A', quantity: 1, price: '555.00' }]));
    assert.equal(feb29.reason, 'INVALID_DATE');
    const cheapImpossible = resolvePromotion(snap({ created_at: '2026-09-31T00:00:00+08:00' }, [{ sku: 'A', quantity: 1, price: '100.00' }]));
    assert.equal(cheapImpossible.reason, 'INELIGIBLE_BELOW_THRESHOLD');
    assert.deepEqual(cheapImpossible.issues, []);
    assert.equal(resolvePromotion(snap({ created_at: '2028-02-29T00:00:00+08:00' }, [{ sku: 'A', quantity: 1, price: '555.00' }])).giftAction, 'add');
  });
});

describe('promotion resolver gifts and choices', () => {
  it('identifies a complete-capture net-zero CK-08 line as the existing gift without requiring a marker', () => {
    const existing = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', variant_id: PROMOTION_GIFT_VARIANT_ID, quantity: 1, price: '79.00', total_discount: '79.00' },
    ]));
    assert.equal(existing.giftAction, 'existing');
    assert.equal(existing.existingGiftQuantity, 1);
    const free = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', quantity: 1, price: '0.00' },
    ]));
    assert.equal(free.giftAction, 'existing');
  });

  it('does not treat other SKU free lines or missing capture as existing gifts', () => {
    const otherFree = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'STICKER', quantity: 1, price: '0.00' },
    ]));
    assert.equal(otherFree.giftAction, 'add');
    assert.equal(otherFree.existingGiftQuantity, 0);
    const old = stripPromotionCapture(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', quantity: 1, price: '0.00' },
    ]));
    assert.equal(resolvePromotion(old).reason, 'MISSING_CAPTURE');
    const cheapOld = stripPromotionCapture(snap({}, [{ sku: 'A', quantity: 1, price: '100.00' }]));
    assert.equal(resolvePromotion(cheapOld).giftAction, 'ineligible');
    assert.deepEqual(resolvePromotion(cheapOld).issues, []);
  });

  it('blocks marker/variant/SKU contradictions, multiple gifts and decline-with-gift', () => {
    assert.equal(resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00', properties: [{ name: '_jc_gift_555', value: 'true' }] },
    ])).reason, 'INVALID_MARKER');
    assert.equal(resolvePromotion(snap({}, [
      { sku: 'CK-08', quantity: 1, price: '79.00', properties: [{ name: '_jc_gift_555', value: 'true' }] },
      { sku: 'B', quantity: 1, price: '555.00' },
    ])).reason, 'INVALID_MARKER');
    assert.equal(resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', quantity: 1, price: '0.00' },
      { sku: 'CK-08', quantity: 1, price: '0.00' },
    ])).reason, 'MULTIPLE_GIFTS');
    assert.equal(resolvePromotion(snap({
      note_attributes: [{ name: 'jc_mooncake_choice', value: 'decline' }],
    }, [{ sku: 'A', quantity: 1, price: '555.00' }])).giftAction, 'declined');
    assert.equal(resolvePromotion(snap({
      note_attributes: [{ name: 'jc_mooncake_choice', value: 'decline' }],
    }, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', quantity: 1, price: '0.00' },
    ])).reason, 'CONTRADICTION');
    assert.equal(resolvePromotion(snap({
      note_attributes: [{ name: 'jc_mooncake_choice', value: 'keep' }, { name: 'jc_mooncake_choice', value: 'decline' }],
    }, [{ sku: 'A', quantity: 1, price: '555.00' }])).reason, 'DUPLICATE_CHOICE');
    assert.equal(resolvePromotion(snap({
      note_attributes: [{ name: 'jc_mooncake_choice', value: 'maybe' }],
    }, [{ sku: 'A', quantity: 1, price: '555.00' }])).reason, 'UNKNOWN_CHOICE');
  });

  it('fails closed on identity conflict, duplicate/invalid markers and choices, and still identifies a single present identifier', () => {
    const skuAndWrongVariant = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', variant_id: '123', quantity: 1, price: '0.00' },
    ]));
    assert.equal(skuAndWrongVariant.reason, 'IDENTITY_CONFLICT');
    assert.equal(skuAndWrongVariant.giftAction, 'uncertain');
    assert.notEqual(skuAndWrongVariant.giftAction, 'existing');
    assert.ok(skuAndWrongVariant.issues.length > 0);

    const otherAndCanonicalVariant = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'OTHER', variant_id: PROMOTION_GIFT_VARIANT_ID, quantity: 1, price: '0.00' },
    ]));
    assert.equal(otherAndCanonicalVariant.reason, 'IDENTITY_CONFLICT');
    assert.notEqual(otherAndCanonicalVariant.giftAction, 'existing');

    const skuOnly = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', quantity: 1, price: '0.00' },
    ]));
    assert.equal(skuOnly.giftAction, 'existing');
    assert.equal(skuOnly.existingGiftQuantity, 1);

    const variantOnly = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: '', variant_id: PROMOTION_GIFT_VARIANT_ID, quantity: 1, price: '0.00' },
    ]));
    assert.equal(variantOnly.giftAction, 'existing');

    const otherFree = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'STICKER', variant_id: '999', quantity: 1, price: '0.00' },
    ]));
    assert.equal(otherFree.giftAction, 'add');
    assert.equal(otherFree.existingGiftQuantity, 0);
    assert.equal(otherFree.reason, 'ADD_HQ_GIFT');

    const markedConflict = resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', variant_id: '123', quantity: 1, price: '0.00', properties: [{ name: '_jc_gift_555', value: 'true' }] },
    ]));
    assert.equal(markedConflict.reason, 'IDENTITY_CONFLICT');

    assert.equal(resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', quantity: 1, price: '0.00', properties: [
        { name: '_jc_gift_555', value: 'true' }, { name: '_jc_gift_555', value: 'true' },
      ] },
    ])).reason, 'DUPLICATE_MARKER');
    assert.equal(resolvePromotion(snap({}, [
      { sku: 'A', quantity: 1, price: '555.00' },
      { sku: 'CK-08', quantity: 1, price: '0.00', properties: [{ name: '_jc_gift_555', value: '' }] },
    ])).reason, 'INVALID_MARKER');
    assert.equal(resolvePromotion(snap({
      note_attributes: [{ name: 'jc_mooncake_choice', value: 'keep' }, { name: 'jc_mooncake_choice', value: 'keep' }],
    }, [{ sku: 'A', quantity: 1, price: '555.00' }])).reason, 'DUPLICATE_CHOICE');
    assert.equal(resolvePromotion(snap({
      note_attributes: [{ name: 'jc_mooncake_choice', value: '' }],
    }, [{ sku: 'A', quantity: 1, price: '555.00' }])).reason, 'INVALID_CHOICE');
    assert.equal(resolvePromotion(snap({
      note_attributes: [{ name: 'jc_mooncake_choice', value: 'keep' }],
    }, [{ sku: 'A', quantity: 1, price: '555.00' }])).giftAction, 'add');
  });
});
