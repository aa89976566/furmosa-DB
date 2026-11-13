import assert from 'node:assert/strict';
import test from 'node:test';
import { outstandingDemand, type DemandGroup, type DemandPosting } from '../outstanding-demand.ts';
const group: DemandGroup = { id: 'order:1', references: ['order:1', 'shipment:1'], items: [{ quantity: 2, weightGrams: 50, variantKey: 't',
  product: { id: 'salmon', sku: 'FUR-0129', unit: 'g', category: 'treats', inventorySourceProductId: null,
    priceTiers: [{ id: 't', weightGrams: 50, unit: 'g', unitQty: 1, bundleComponents: [] }] } }] };
const posted: DemandPosting = { reference: 'shipment:1', productId: 'salmon', quantity: -50, reversal: null };
test('two pending 50g items reserve100g; partial posting reserves only remaining50g', () => {
  assert.equal(outstandingDemand([group], []).reserved.get('salmon'), 100);
  assert.equal(outstandingDemand([group], [posted]).reserved.get('salmon'), 50);
  assert.equal(outstandingDemand([group], [{ ...posted, quantity: -100 }]).reserved.get('salmon'), 0);
});
test('cancelled demand disappears; reversed posting does not falsely release outstanding demand', () => {
  assert.equal(outstandingDemand([], [posted]).reserved.size, 0);
  assert.equal(outstandingDemand([group], [{ ...posted, reversal: { quantity: 50 } }]).reserved.get('salmon'), 100);
});
test('duplicate order snapshot and missing mapping mark the result incomplete', () => {
  assert.equal(outstandingDemand([group, group], []).complete, false);
  assert.equal(outstandingDemand([{ ...group, items: [] }], []).complete, false);
  assert.equal(outstandingDemand([{ ...group, items: [{ ...group.items[0], variantKey: 'unknown' }] }], []).complete, false);
});
test('bundle demand follows explicit recipe and ledger for each ingredient', () => {
  const line = structuredClone(group.items[0]);
  line.quantity = 1; line.weightGrams = 45; line.product.priceTiers[0].weightGrams = 45;
  line.product.priceTiers[0].bundleComponents = ['a', 'b', 'c'].map(componentProductId => ({ componentProductId, gramsPerPack: 15 }));
  const result = outstandingDemand([{ ...group, items: [line] }], [{ ...posted, productId: 'a', quantity: -15 }]);
  assert.equal(result.complete, true);
  assert.deepEqual([...result.reserved.values()], [0, 15, 15]);
});
