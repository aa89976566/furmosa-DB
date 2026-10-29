import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateNextProductIdentity } from '../product-id';

test('allocates matching PROD and FUR identity after the highest valid sequence', async () => {
  const db = { product: { findMany: async () => [
    { productId: 'PROD-0002' }, { productId: 'PROD-0010' }, { productId: 'PROD-OLD' },
  ] } };
  assert.deepEqual(await allocateNextProductIdentity(db), { productId: 'PROD-0011', sku: 'FUR-0011' });
});
