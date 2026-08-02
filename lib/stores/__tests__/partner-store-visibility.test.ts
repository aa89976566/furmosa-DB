import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  inferPartnerStoreRegion,
  isCustomerFacingPartnerStore,
  isInternalMerchantId,
} from '../partner-store-visibility';

describe('partner-store-visibility', () => {
  it('錯誤店家對照／測試店不可給顧客看', () => {
    assert.equal(
      isCustomerFacingPartnerStore({
        slug: 'mer_other',
        name: '錯誤店家對照（勿交付）',
      }),
      false,
    );
    assert.equal(
      isCustomerFacingPartnerStore({
        slug: 'mer_refill',
        name: '匠寵換罐測試店',
      }),
      false,
    );
    assert.equal(
      isCustomerFacingPartnerStore({
        slug: 'whatever',
        name: '某某（勿交付）',
      }),
      false,
    );
  });

  it('真實合作店應可見', () => {
    assert.equal(
      isCustomerFacingPartnerStore({ slug: 'zhuwo_zhonghe', name: '豬窩 中和店' }),
      true,
    );
    assert.equal(
      isCustomerFacingPartnerStore({ slug: 'niuniu', name: '淡水妞妞' }),
      true,
    );
  });

  it('內部 merchantId 可辨識', () => {
    assert.equal(isInternalMerchantId('MER-OTHER'), true);
    assert.equal(isInternalMerchantId('mer-refill'), true);
    assert.equal(isInternalMerchantId('MER-0014'), false);
  });

  it('店名可粗分區域', () => {
    assert.equal(inferPartnerStoreRegion('豬窩 板橋店'), '新北據點');
    assert.equal(inferPartnerStoreRegion('淡水妞妞'), '新北據點');
    assert.equal(inferPartnerStoreRegion('墨菲寵物美學'), '其他據點');
  });
});
