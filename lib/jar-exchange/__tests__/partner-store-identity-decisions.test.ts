import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isOfficialExcludedMerchantId,
  isOfficialExcludedStoreSlug,
} from '@/lib/jar-exchange/partner-store-identity-decisions';
import { mergePartnerStoreDirectory } from '@/lib/jar-exchange/partner-store-directory';
import type { JarExchangeMerchantRow } from '@/lib/jar-exchange/partner-merchants';
import type { PartnerStoreView } from '@/lib/stores/partner-stores';

describe('official list exclusion', () => {
  it('hides known test and demo merchants from the official directory', () => {
    assert.equal(isOfficialExcludedMerchantId('MER-OTHER'), true);
    assert.equal(isOfficialExcludedMerchantId('MER-REFILL'), true);
    assert.equal(isOfficialExcludedMerchantId('MER-DEMO'), true);
    assert.equal(isOfficialExcludedMerchantId('MER-0015'), false);
    assert.equal(isOfficialExcludedStoreSlug('mer_other'), true);
    assert.equal(isOfficialExcludedStoreSlug('niuniu'), false);

    const stores: PartnerStoreView[] = [
      { id: '1', slug: 'pet99', name: '99寵物美容', groomingDiscountAmount: 200 },
      { id: '2', slug: 'mer_other', name: '錯誤店家對照', groomingDiscountAmount: 200 },
    ];
    const merchants: JarExchangeMerchantRow[] = [
      { id: 'a', merchantId: 'MER-DEMO', name: 'Furmosa Preview 店', city: null, types: ['jar_exchange'] },
      { id: 'b', merchantId: 'MER-REFILL', name: '匠寵換罐測試店', city: null, types: ['jar_exchange'] },
      { id: 'c', merchantId: 'MER-0014', name: '柒沐寵物美容', city: null, types: ['jar_exchange'] },
    ];
    const rows = mergePartnerStoreDirectory({ stores, merchants });
    assert.equal(rows.some((row) => row.slug === 'pet99'), true);
    assert.equal(rows.some((row) => row.merchantId === 'MER-DEMO'), false);
    assert.equal(rows.some((row) => row.merchantId === 'MER-REFILL'), false);
    assert.equal(rows.some((row) => row.slug === 'mer_other'), false);
  });
});
