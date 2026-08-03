import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  storeSlugToMerchantCode,
} from '@/lib/stores/store-merchant-link';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';
import {
  refillAdminSyncNote,
  refillDeliveryNote,
} from '@/lib/jar-exchange/refill-inventory';

describe('store ↔ merchant link', () => {
  it('round-trips MER-* slug convention', () => {
    assert.equal(merchantToStoreSlug('MER-0001'), 'mer_0001');
    assert.equal(storeSlugToMerchantCode('mer_0001'), 'MER-0001');
    assert.equal(storeSlugToMerchantCode('mer_0016'), 'MER-0016');
  });

  it('maps 豬窩 custom store slugs', () => {
    assert.equal(storeSlugToMerchantCode('zhuwo_zhonghe'), 'MER-0016');
    assert.equal(storeSlugToMerchantCode('zhuwo_banqiao'), 'MER-0019');
    assert.equal(storeSlugToMerchantCode('zhuwo_tucheng'), 'MER-0020');
    assert.equal(storeSlugToMerchantCode('mer_0016'), 'MER-0016');
  });

  it('returns null for unknown slugs', () => {
    assert.equal(storeSlugToMerchantCode('unknown_store'), null);
  });
});

describe('refill inventory notes', () => {
  it('builds stable idempotent note keys', () => {
    assert.equal(refillDeliveryNote('ord_1'), 'refill_delivery:ord_1');
    assert.equal(refillAdminSyncNote('store_x'), 'refill_admin_sync:store_x');
  });
});
