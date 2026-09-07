import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shopifySnapshot, type Snapshot } from '../../shopify/intake-policy';
import { MOONCAKE_CATALOG } from '../../products/mooncake-catalog';
import { buildFulfillmentPlan, parseFrozenFulfillmentPlan } from '../fulfillment-plan';
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
    const mixedPlan = buildFulfillmentPlan(mixed, mixedDraft, [feed, { ...mooncake, defaultTemperature: 'ambient' }]);
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
    assert.ok(result.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT'));
    assert.equal(result.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT'), true);
  });

  it('validates existing Shopify gifts against unique catalog, cost and catalog temperature', () => {
    const giftLine = { sku: 'CK-08', variant_id: '64368368517497', quantity: 1, price: '0.00', requires_shipping: true };
    const paid = { sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true };
    const snapshot = source([paid, giftLine]);
    const draft = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }, { productId: 'ck08', temperature: 'frozen' }],
      method: 'home', temperature: 'frozen', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    const base = { ...mooncake, priceTiers: [{ id: 't50', weightGrams: 50, unit: '顆', unitQty: 1, cost: 30 }] };

    const ambiguous = buildFulfillmentPlan(snapshot, draft, [base, { ...base, id: 'ck08b' }]);
    assert.ok(ambiguous.issues.some(issue => issue.message.includes('多筆')));
    assert.equal(ambiguous.display.determinate, false);
    assert.match(ambiguous.display.expectedShipLabel, /總數待確認/);
    assert.ok(ambiguous.display.details.some(detail => detail.includes('多筆')));

    const badCost = buildFulfillmentPlan(snapshot, draft, [{
      ...base, priceTiers: [{ id: 't50', weightGrams: 50, unit: '顆', unitQty: 1, cost: -1 }],
    }]);
    assert.ok(badCost.issues.some(issue => issue.message.includes('成本')));
    assert.equal(badCost.items.find(item => item.isGift)?.unitCost ?? null, null);
    assert.equal(badCost.display.determinate, false);

    const zeroCost = buildFulfillmentPlan(snapshot, draft, [{
      ...base, cost: 0, priceTiers: [{ id: 't50', weightGrams: 50, unit: '顆', unitQty: 1, cost: 0 }],
    }]);
    assert.equal(zeroCost.promotion.giftAction, 'existing');
    assert.equal(zeroCost.items.find(item => item.isGift)?.unitCost, 0);
    assert.equal(zeroCost.issues.some(issue => issue.message.includes('成本')), false);

    const nullTemp = buildFulfillmentPlan(snapshot, draft, [{ ...base, defaultTemperature: null }]);
    assert.ok(nullTemp.issues.some(issue => issue.code === 'TEMPERATURE_UNKNOWN'));
    assert.equal(nullTemp.display.determinate, false);
    assert.ok(nullTemp.display.details.some(detail => detail.includes('溫層')));
  });

  it('does not let a non-physical line create a temperature conflict', () => {
    const snapshot = source([
      { sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true },
      { sku: 'E-GIFT', quantity: 1, price: '10.00', requires_shipping: false },
    ]);
    const draft = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }, { productId: 'feed', temperature: 'ambient' }],
      method: 'home', temperature: 'frozen', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    const plan = buildFulfillmentPlan(snapshot, draft, [mooncake, feed]);
    assert.equal(plan.items[0].includeInTemperature, true);
    assert.equal(plan.items[1].includeInTemperature, false);
    assert.equal(plan.items.find(item => item.origin === 'hq-gift')?.includeInTemperature, true);
    const result = checkReview(snapshot, draft, [mooncake, feed], false);
    assert.equal(result.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT'), false);
    assert.ok(result.issues.some(issue => issue.code === 'SHIPPING_METHOD_UNKNOWN'));
  });

  it('stores catalog identity in the frozen plan and rejects old versions', () => {
    const snapshot = source([{ sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true }]);
    const plan = buildFulfillmentPlan(snapshot, draftFor(snapshot, 'ck08'), [mooncake]);
    const gift = plan.frozen.lines.find(line => line.origin === 'hq-gift');
    assert.equal(plan.planVersion, 'ck08-555-plan-v2');
    assert.equal(gift?.tierId, 't50');
    assert.equal(gift?.unitCost, 30);
    assert.equal(gift?.catalogTemperature, 'frozen');
    assert.equal(gift?.status, 'active');
    assert.equal(gift?.sku, 'CK-08');
    const v1 = { ...plan.frozen, planVersion: 'ck08-555-plan-v1' };
    assert.equal(parseFrozenFulfillmentPlan(v1), null);
    const missingTier = { ...plan.frozen, lines: plan.frozen.lines.map(line => { const { tierId: _t, ...rest } = line; return rest; }) };
    assert.equal(parseFrozenFulfillmentPlan(missingTier), null);
    const sameStock = buildFulfillmentPlan(snapshot, draftFor(snapshot, 'ck08'), [{ ...mooncake, available: 3 }]);
    assert.equal(sameStock.frozenHash, plan.frozenHash);
    const costDrift = buildFulfillmentPlan(snapshot, draftFor(snapshot, 'ck08'), [{
      ...mooncake, priceTiers: [{ id: 't50', weightGrams: 50, unit: '顆', unitQty: 1, cost: 99 }],
    }]);
    assert.notEqual(costDrift.frozenHash, plan.frozenHash);
    const tierDrift = buildFulfillmentPlan(snapshot, draftFor(snapshot, 'ck08'), [{
      ...mooncake, priceTiers: [{ id: 'replacement', weightGrams: 50, unit: '顆', unitQty: 1, cost: 30 }],
    }]);
    assert.notEqual(tierDrift.frozenHash, plan.frozenHash);
    const tempDrift = buildFulfillmentPlan(snapshot, draftFor(snapshot, 'ck08'), [{ ...mooncake, defaultTemperature: 'ambient' }]);
    assert.notEqual(tempDrift.frozenHash, plan.frozenHash);
  });

  it('aggregates same-product quantity past Int and distinguishes date display labels', () => {
    const overflowSource = source([
      { sku: 'CK-08', quantity: 2000000000, price: '79.00', requires_shipping: true },
      { sku: 'CK-08', quantity: 2000000000, price: '79.00', requires_shipping: true },
    ]);
    const overflowDraft = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }, { productId: 'ck08', temperature: 'frozen' }],
      method: 'home', temperature: 'frozen', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    const overflow = buildFulfillmentPlan(overflowSource, overflowDraft, [mooncake]);
    assert.ok(overflow.issues.some(issue => issue.message.includes('超過安全計算範圍')));

    const before = source([{ sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true }]);
    before.order.created_at = '2026-08-27T06:54:59+08:00';
    assert.equal(buildFulfillmentPlan(before, draftFor(before, 'ck08'), [mooncake]).display.statusLabel, '活動期間外');
    const cheap = source([{ sku: 'FD-01', quantity: 1, price: '100.00', requires_shipping: true }]);
    const cheapDraft = reviewDraft({
      lines: [{ productId: 'feed', temperature: 'ambient' }],
      method: 'home', temperature: 'ambient', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    assert.equal(buildFulfillmentPlan(cheap, cheapDraft, [feed, mooncake]).display.statusLabel, '未達門檻');
  });

  it('blocks source-gift chosen temperature that contradicts catalog, and shipping mismatches, on the same plan', () => {
    const giftLine = { sku: 'CK-08', variant_id: '64368368517497', quantity: 1, price: '0.00', requires_shipping: true };
    const paid = { sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true };
    const snapshot = source([paid, giftLine]);
    const chosenAmbient = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }, { productId: 'ck08', temperature: 'ambient' }],
      method: 'home', temperature: 'frozen', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    const chosen = buildFulfillmentPlan(snapshot, chosenAmbient, [mooncake]);
    assert.ok(chosen.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT' && issue.message.includes('人工溫層')));
    assert.equal(chosen.items.find(item => item.isGift)?.temperature, 'frozen');
    assert.equal(chosen.display.determinate, false);
    assert.match(chosen.display.expectedShipLabel, /總數待確認/);
    assert.ok(chosen.display.details.some(detail => detail.includes('人工溫層')));
    assert.equal(chosen.display.expectedShipLabel.includes('預計出貨 11'), false);

    const emptyChosen = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }, { productId: 'ck08', temperature: '' }],
      method: 'home', temperature: 'frozen', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    const unknown = buildFulfillmentPlan(snapshot, emptyChosen, [mooncake]);
    assert.ok(unknown.issues.some(issue => issue.code === 'TEMPERATURE_UNKNOWN'));
    assert.equal(unknown.display.determinate, false);

    const invalidChosen = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }, { productId: 'ck08', temperature: 'hot' }],
      method: 'home', temperature: 'frozen', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    assert.ok(buildFulfillmentPlan(snapshot, invalidChosen, [mooncake]).issues.some(issue => issue.code === 'TEMPERATURE_UNKNOWN'));

    const shipAmbient = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }, { productId: 'ck08', temperature: 'frozen' }],
      method: 'home', temperature: 'ambient', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    const ship = buildFulfillmentPlan(snapshot, shipAmbient, [mooncake]);
    assert.ok(ship.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT' && issue.message.includes('配送溫層')));
    assert.equal(ship.display.determinate, false);
    assert.match(ship.display.expectedShipLabel, /總數待確認/);
    assert.ok(ship.display.details.some(detail => detail.includes('配送溫層')));

    const digitalGift = source([
      paid,
      { sku: 'CK-08', variant_id: '64368368517497', quantity: 1, price: '0.00', requires_shipping: false },
    ]);
    const digital = buildFulfillmentPlan(digitalGift, shipAmbient, [mooncake]);
    assert.equal(digital.items.find(item => item.isGift)?.includeInTemperature, true);
    assert.ok(digital.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT'));
    assert.equal(digital.display.determinate, false);

    const hqShip = source([{ sku: 'CK-08', quantity: 10, price: '79.00', requires_shipping: true }]);
    const hqAmbientShip = reviewDraft({
      lines: [{ productId: 'ck08', temperature: 'frozen' }],
      method: 'home', temperature: 'ambient', recipient: '測試', phone: '0912345678', address: '地址', giftsConfirmed: true,
    });
    const hq = buildFulfillmentPlan(hqShip, hqAmbientShip, [mooncake]);
    assert.ok(hq.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT' && issue.message.includes('配送溫層')));
    assert.equal(hq.display.determinate, false);
    assert.match(hq.display.expectedShipLabel, /總數待確認/);

    const aligned = buildFulfillmentPlan(snapshot, draftFor(snapshot, 'ck08'), [mooncake]);
    assert.equal(aligned.issues.some(issue => issue.code === 'TEMPERATURE_CONFLICT' || issue.code === 'TEMPERATURE_UNKNOWN'), false);
    assert.equal(aligned.display.determinate, true);
    assert.equal(aligned.display.expectedShipQuantity, 11);
  });
});
