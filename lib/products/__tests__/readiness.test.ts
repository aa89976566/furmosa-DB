import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveProductReadiness } from '../readiness.ts';

const base = {
  consignmentEnabled: false,
  wholesaleEnabled: false,
  defaultConsignmentCommissionMode: null,
  defaultConsignmentCommissionValue: null,
};

test('zero tiers never reports variants or enabled wholesale as complete', () => {
  const result = deriveProductReadiness({ ...base, wholesaleEnabled: true, priceTiers: [] });
  assert.equal(result.variants.state, 'incomplete');
  assert.equal(result.variants.actionLabel, '新增規格');
  assert.equal(result.wholesale.state, 'incomplete');
  assert.equal(result.wholesale.actionLabel, '先新增規格');
});

test('disabled modes ignore stale values', () => {
  const result = deriveProductReadiness({
    ...base,
    defaultConsignmentCommissionMode: 'percent',
    defaultConsignmentCommissionValue: 2_000,
    priceTiers: [],
  });
  assert.equal(result.consignment.state, 'disabled');
  assert.equal(result.consignment.summary, '未啟用');
});

test('active tiers report partial SKU and buyout readiness', () => {
  const result = deriveProductReadiness({
    ...base,
    wholesaleEnabled: true,
    priceTiers: [
      { status: 'active', sku: 'A-30', shopifySku: 'SHOP-A', defaultWholesaleUnitPrice: 100 },
      { status: 'active', sku: null, shopifySku: null, defaultWholesaleUnitPrice: null },
    ],
  });
  assert.equal(result.variants.summary, '缺 1 個 SKU（1/2）');
  assert.equal(result.wholesale.summary, '1/2 個規格已定價');
  assert.equal(result.needsAttention, true);
});

test('archived tiers are excluded from readiness denominators', () => {
  const result = deriveProductReadiness({
    ...base,
    wholesaleEnabled: true,
    priceTiers: [
      { status: 'active', sku: 'A-30', shopifySku: 'SHOP-A', defaultWholesaleUnitPrice: 100 },
      { status: 'archived', sku: null, shopifySku: null, defaultWholesaleUnitPrice: null },
    ],
  });
  assert.equal(result.variants.summary, '1 個規格皆有 SKU');
  assert.equal(result.wholesale.summary, '1/1 個規格已定價');
});

test('commission validation matches the existing product form rules', () => {
  const valid = deriveProductReadiness({
    ...base,
    consignmentEnabled: true,
    defaultConsignmentCommissionMode: 'percent',
    defaultConsignmentCommissionValue: 2_000,
    priceTiers: [],
  });
  const zero = deriveProductReadiness({
    ...base,
    consignmentEnabled: true,
    defaultConsignmentCommissionMode: 'amount',
    defaultConsignmentCommissionValue: 0,
    priceTiers: [],
  });
  assert.equal(valid.consignment.state, 'complete');
  assert.equal(zero.consignment.state, 'incomplete');
});
