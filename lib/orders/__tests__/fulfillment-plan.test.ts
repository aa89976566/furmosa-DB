import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shopifySnapshot, type Snapshot } from '../../shopify/intake-policy';
import { MOONCAKE_CATALOG } from '../../products/mooncake-catalog';
import { buildFulfillmentPlan } from '../fulfillment-plan';
import { checkReview, reviewDraft, type ReviewProduct } from '../review-policy';

const mooncake: ReviewProduct = {
  id: 'ck08', name: MOONCAKE_CATALOG.name, sku: 'CK-08', sourceSku: 'CK-08', status: 'active',
  available: 20, cost: MOONCAKE_CATALOG.cost, unit: '顆', productCategory: 'STANDARD',
  defaultTemperature: 'frozen',
  priceTiers: [{ id: 't50', weightGrams: 50, unit: '顆', unitQty: 1, cost: 30 }],
};
const feed: ReviewProduct = {
  id: 'feed', name: '飼料', sku: 'FD-01', sourceSku: 'FD-01', status: 'active',
  available: 20, cost: 10, unit: '包', productCategory: 'STANDARD', defaultTemperature: 'ambient',
  priceTiers: [],
};

function source(lines: Record<string, unknown>[], extra: Record<string, unknown> = {}): Snapshot {
  return shopifySnapshot({
    id: '10', currency: 'TWD', created_at: '2026-09-01T00:00:00+08:00', updated_at: '2026-09-01T01:00:00+08:00',
    financial_status: 'paid', subtotal_price: '790.00', total_discounts: '0.00', total_price: '790.00',
    total_shipping_price_set: { shop_money: { amount: '0.00' } },
    line_items: lines, ...extra,
  });
}

function draftFor(snapshot: Snapshot, productId: string, temperature = 'frozen') {
  const rows = Array.isArray(snapshot.order.line_items) ? snapshot.order.line_items : [];
  return reviewDraft({
    lines: rows.map(() => ({ productId, temperature })),
    method: 'home', temperature, recipient: '測試', phone: '0912345678', address: '地址',
    giftsConfirmed: true,
  });
}

describe('fulfillment plan gift lines', () => {
  it('keeps purchased quantity 10 and adds an independent HQ gift of 1 at 50g', () => {
    const snapshot = source([{ sku: 'CK-08', title: '月餅', quantity: 10, price: '79.00', requires_shipping: true }]);
    const plan = buildFulfillmentPlan(snapshot, draftFor(snapshot, 'ck08'), [mooncake]);
    assert.equal(plan.promotion.giftAction, 'add');
    assert.equal(plan.items.length, 2);
    assert.equal(plan.items[0].quantity, 10);
    assert.equal(plan.items[0].isGift, false);
    assert.equal(plan.items[0].unitPrice, 79);
    assert.equal(plan.items[1].origin, 'hq-gift');
    assert.equal(plan.items[1].quantity, 1);
    assert.equal(plan.items[1].isGift, true);
    assert.equal(plan.items[1].unitPrice, 0);
    assert.equal(plan.items[1].subtotal, 0);
    assert.equal(plan.items[1].weightGrams, 50);
    assert.equal(plan.items[1].unit, '顆');
    assert.equal(plan.items[0].weightGrams, 50);
    assert.equal(plan.neededQuantities.ck08, 11);
    assert.equal(plan.display.expectedShipQuantity, 11);
    assert.match(plan.display.expectedShipLabel, /11 顆/);
    assert.equal(plan.display.statusLabel, 'HQ補贈');
  });

  it('does not add a second gift when Shopify already has a net-zero CK-08 line', () => {
    const snapshot = source([
      { sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true },
      { sku: 'CK-08', variant_id: '64368368517497', quantity: 1, price: '79.00', total_discount: '79.00', requires_shipping: true },
    ]);
    const plan = buildFulfillmentPlan(snapshot, draftFor(snapshot, 'ck08'), [mooncake]);
    assert.equal(plan.promotion.giftAction, 'existing');
    assert.equal(plan.items.length, 2);
    assert.equal(plan.items[1].isGift, true);
    assert.equal(plan.items[1].unitPrice, 0);
    assert.equal(plan.neededQuantities.ck08, 11);
    assert.equal(plan.display.expectedShipQuantity, 11);
    assert.equal(plan.display.statusLabel, 'Shopify已有');
  });

  it('does not add a gift after decline and does not count other free SKUs as this campaign', () => {
    const declined = source(
      [{ sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true }],
      { note_attributes: [{ name: 'jc_mooncake_choice', value: 'decline' }] },
    );
    const declinedPlan = buildFulfillmentPlan(declined, draftFor(declined, 'ck08'), [mooncake]);
    assert.equal(declinedPlan.promotion.giftAction, 'declined');
    assert.equal(declinedPlan.items.length, 1);
    assert.equal(declinedPlan.neededQuantities.ck08, 10);
    const mixed = source([
      { sku: 'FD-01', quantity: 1, price: '555.00', requires_shipping: true },
      { sku: 'STICKER', quantity: 1, price: '0.00', requires_shipping: true },
    ]);
    const mixedDraft = reviewDraft({
      lines: [{ productId: 'feed', temperature: 'ambient' }, { productId: 'feed', temperature: 'ambient' }],
      method: 'home', temperature: 'ambient', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    const mixedPlan = buildFulfillmentPlan(mixed, mixedDraft, [feed, mooncake]);
    assert.equal(mixedPlan.promotion.giftAction, 'add');
    assert.equal(mixedPlan.items.filter(item => item.origin === 'hq-gift').length, 1);
    assert.equal(mixedPlan.display.otherGiftQuantity, 1);
    assert.match(mixedPlan.display.expectedShipLabel, /件/);
  });

  it('blocks missing, ambiguous, inactive, special and wrong-tier mooncake gifts', () => {
    const snapshot = source([{ sku: 'FD-01', quantity: 1, price: '555.00', requires_shipping: true }]);
    const draft = reviewDraft({
      lines: [{ productId: 'feed', temperature: 'ambient' }],
      method: 'home', temperature: 'ambient', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    assert.ok(buildFulfillmentPlan(snapshot, draft, [feed]).issues.some(issue => issue.message.includes('找不到')));
    assert.ok(buildFulfillmentPlan(snapshot, draft, [feed, mooncake, { ...mooncake, id: 'ck08b' }]).issues.some(issue => issue.message.includes('多筆')));
    assert.ok(buildFulfillmentPlan(snapshot, draft, [feed, { ...mooncake, status: 'inactive' }]).issues.some(issue => issue.message.includes('不是唯一有效')));
    assert.ok(buildFulfillmentPlan(snapshot, draft, [feed, { ...mooncake, productCategory: 'SERVICE' }]).issues.some(issue => issue.message.includes('不是唯一有效')));
    assert.ok(buildFulfillmentPlan(snapshot, draft, [feed, {
      ...mooncake, priceTiers: [{ id: 't100', weightGrams: 100, unit: '顆', unitQty: 1, cost: 30 }],
    }]).issues.some(issue => issue.message.includes('50g')));
    const result = checkReview(snapshot, draft, [feed, mooncake], false);
    assert.equal(result.plan.neededQuantities.feed, 1);
    assert.equal(result.plan.neededQuantities.ck08, 1);
    assert.ok(result.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT') || result.plan.items.some(item => item.temperature === 'frozen'));
  });
});
