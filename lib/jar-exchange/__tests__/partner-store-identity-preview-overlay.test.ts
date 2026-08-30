import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergePartnerStoreDirectory } from '@/lib/jar-exchange/partner-store-directory';
import { withPreviewReadOnlyOverlay } from '@/lib/jar-exchange/partner-store-identity-preview-overlay';
import { GROOMING_COUPON_DISCOUNT_ZHUWO } from '@/lib/coupons/store-discount';
import type { JarExchangeMerchantRow } from '@/lib/jar-exchange/partner-merchants';
import type { PartnerStoreView } from '@/lib/stores/partner-stores';

function store(slug: string, name: string): PartnerStoreView {
  return {
    id: `store_${slug}`,
    slug,
    name,
    groomingDiscountAmount: slug.startsWith('zhuwo') ? GROOMING_COUPON_DISCOUNT_ZHUWO : 200,
  };
}

function merchant(merchantId: string, name: string): JarExchangeMerchantRow {
  return {
    id: `merchant_${merchantId}`,
    merchantId,
    name,
    city: '新北',
    types: ['jar_exchange'],
  };
}

describe('preview read-only overlay', () => {
  it('does nothing outside Preview', () => {
    assert.deepEqual(withPreviewReadOnlyOverlay([], 'production'), []);
    assert.deepEqual(withPreviewReadOnlyOverlay([], undefined), []);
  });

  it('merges the five locked stores and keeps Zhuwo separate in Preview', () => {
    const decisions = withPreviewReadOnlyOverlay([], 'preview');
    const rows = mergePartnerStoreDirectory(
      {
        stores: [
          store('zhuwo_banqiao', '豬窩 板橋店'),
          store('zhuwo_tucheng', '豬窩 土城店'),
          store('zhuwo_zhonghe', '豬窩 中和店'),
          store('manlisa', '曼利莎寵物美容'),
          store('niuniu', '淡水妞妞'),
          store('pet99', '99寵物美容'),
        ],
        merchants: [
          merchant('MER-0019', '豬窩 板橋店'),
          merchant('MER-0020', '豬窩 土城店'),
          merchant('MER-0016', '豬窩 中和店'),
          merchant('MER-0017', '曼利莎寵物美容'),
          merchant('MER-0010', '淡水妞妞'),
          merchant('MER-OTHER', '錯誤店家對照（勿交付）'),
          merchant('MER-REFILL', '匠寵換罐測試店'),
          merchant('MER-DEMO', 'Furmosa Preview 店'),
        ],
      },
      decisions,
    );
    const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row]));
    assert.equal(bySlug.zhuwo_banqiao.merchantId, 'MER-0019');
    assert.equal(bySlug.zhuwo_tucheng.merchantId, 'MER-0020');
    assert.equal(bySlug.zhuwo_zhonghe.merchantId, 'MER-0016');
    assert.equal(bySlug.manlisa.merchantId, 'MER-0017');
    assert.equal(bySlug.niuniu.merchantId, 'MER-0010');
    assert.equal(bySlug.zhuwo_banqiao.confirmation?.displayOnly, true);
    assert.equal(bySlug.pet99.identityNote, 'needs_review');
    assert.equal(Boolean(bySlug.mer_other), false);
    assert.equal(Boolean(bySlug.mer_refill), false);
    assert.equal(rows.filter((row) => row.slug.startsWith('zhuwo_')).length, 3);
  });
});
