import assert from 'node:assert/strict';
import test from 'node:test';
import { planSellablePacks, type GramPool, type SellablePack } from '../sellable-packs.ts';

const salmon: SellablePack = { tierId: 'salmon-50', shopifyVariantId: '64882303271289',
  requirements: [{ productId: 'salmon', gramsPerPack: 50 }] };
const pool = (onHand = 100, reserved = 0): GramPool => ({ productId: 'salmon', unit: 'g', onHand, reserved });
const run = (pools = [pool()], packs = [salmon], snapshotComplete = true) =>
  planSellablePacks({ pools, packs, snapshotComplete });

test('100g can sell two 50g packs before packing; remainders round down', () => {
  assert.equal(run()[0].available, 2);
  assert.equal(run([pool(99)])[0].available, 1);
  assert.equal(run([pool(49)])[0].available, 0);
});
test('reserve on order, release on cancellation, post on shipment without double deduction', () => {
  assert.equal(run([pool(100, 50)])[0].available, 1);
  assert.equal(run([pool(100, 0)])[0].available, 2);
  assert.equal(run([pool(50, 0)])[0].available, 1);
  assert.equal(run([pool(0, 50)])[0].available, 0);
  assert.equal(run([pool(-50, 0)])[0].available, 0);
});
test('three-flavour 15g recipe is limited by the scarcest ingredient', () => {
  const requirements = ['okra', 'fish', 'goji'].map(productId => ({ productId, gramsPerPack: 15 }));
  const pools = requirements.map((r, i) => ({ productId: r.productId, unit: '克', onHand: [100, 100, 44][i], reserved: 0 }));
  const packs = [{ tierId: 'family', shopifyVariantId: '65206464840057', requirements }];
  assert.equal(run(pools, packs)[0].available, 2);
  pools[2].reserved = 15;
  assert.equal(run(pools, packs)[0].available, 1);
  assert.equal(run(pools.slice(0, 2), packs)[0].available, null);
});
test('shared ingredients cannot independently publish the same grams twice', () => {
  const other = { ...salmon, tierId: 'salmon-100', shopifyVariantId: '123',
    requirements: [{ productId: 'salmon', gramsPerPack: 100 }] };
  for (const row of run([pool()], [salmon, other])) {
    assert.equal(row.available, null);
    assert.ok(row.issues.includes('SHARED_POOL_REQUIRES_ALLOCATION'));
  }
});
test('unknown units, incomplete reservations, duplicate bindings and invalid recipes block publication', () => {
  assert.equal(run([pool()], [salmon], false)[0].available, null);
  for (const unit of [null, '包']) assert.equal(run([{ ...pool(), unit }])[0].available, null);
  assert.equal(run([pool(), pool()])[0].available, null);
  assert.equal(run([pool(100, -1)])[0].available, null);
  assert.equal(run([pool(100.5)])[0].available, null);
  assert.equal(run([pool()], [salmon, salmon])[0].available, null);
  for (const gramsPerPack of [0, -15, 1.5, NaN]) {
    assert.equal(run([pool()], [{ ...salmon, requirements: [{ productId: 'salmon', gramsPerPack }] }])[0].available, null);
  }
  assert.equal(run([pool()], [{ ...salmon, requirements: [] }])[0].available, null);
  assert.equal(run([pool()], [{ ...salmon, requirements: [...salmon.requirements, ...salmon.requirements] }])[0].available, null);
});
