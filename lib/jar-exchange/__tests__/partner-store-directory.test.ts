import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { JarExchangeMerchantRow } from '@/lib/jar-exchange/partner-merchants';
import {
  mergePartnerStoreDirectory,
  partnerStoreDirectoryStats,
  partnerStoreSourceKind,
  partnerStoreSourceLabel,
  partnerStoreStatusCopy,
  partnerStoreExceptionLabel,
  partnerStoreNeedsIdentityNote,
} from '@/lib/jar-exchange/partner-store-directory';
import { GROOMING_COUPON_DISCOUNT_DEFAULT, GROOMING_COUPON_DISCOUNT_ZHUWO } from '@/lib/coupons/store-discount';
import type { PartnerStoreView } from '@/lib/stores/partner-stores';
import { merchantToStoreSlug } from '@/lib/stores/sync-merchant-stores';

function store(partial: Partial<PartnerStoreView> & Pick<PartnerStoreView, 'slug' | 'name'>): PartnerStoreView {
  return {
    id: partial.id ?? `store_${partial.slug}`,
    slug: partial.slug,
    name: partial.name,
    groomingDiscountAmount: partial.groomingDiscountAmount ?? GROOMING_COUPON_DISCOUNT_DEFAULT,
  };
}

function merchant(
  partial: Partial<JarExchangeMerchantRow> & Pick<JarExchangeMerchantRow, 'merchantId' | 'name'>,
): JarExchangeMerchantRow {
  return {
    id: partial.id ?? `merchant_${partial.merchantId}`,
    merchantId: partial.merchantId,
    name: partial.name,
    city: partial.city ?? null,
    types: partial.types ?? ['jar_exchange'],
  };
}

describe('mergePartnerStoreDirectory', () => {
  it('returns empty list and zero stats when both sources are empty', () => {
    const rows = mergePartnerStoreDirectory({ stores: [], merchants: [] });
    assert.deepEqual(rows, []);
    assert.deepEqual(partnerStoreDirectoryStats(rows), {
      total: 0,
      redeemableCount: 0,
      jarExchangeCount: 0,
      officialOneToOneCount: 0,
      needsReviewCount: 0,
    });
  });

  it('keeps a redeem-only store and marks it as not in jar-exchange backend', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [store({ slug: 'niuniu', name: '淡水妞妞', groomingDiscountAmount: 200 })],
      merchants: [],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'niuniu');
    assert.equal(rows[0].name, '淡水妞妞');
    assert.equal(rows[0].canRedeem, true);
    assert.equal(rows[0].hasJarExchangeMerchant, false);
    assert.equal(rows[0].city, null);
    assert.equal(rows[0].merchantRecordId, null);
    assert.deepEqual(rows[0].types, []);
    assert.equal(partnerStoreSourceKind(rows[0]), 'redeem_only');
    assert.equal(partnerStoreSourceLabel.redeem_only, '僅核銷清單');
    assert.deepEqual(partnerStoreStatusCopy(rows[0]), {
      label: '可核銷 · 待確認',
      tone: 'gap',
    });
    assert.equal(partnerStoreExceptionLabel(rows[0]), '待確認');
    assert.equal(rows[0].identityNote, 'needs_review');
    assert.equal(partnerStoreNeedsIdentityNote(rows[0]), true);
  });

  it('keeps a jar-exchange-only merchant and marks it as not redeemable', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [],
      merchants: [
        merchant({
          merchantId: 'MER-0099',
          name: '新開的換罐店',
          city: '台北',
          types: ['consignment', 'jar_exchange'],
        }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, merchantToStoreSlug('MER-0099'));
    assert.equal(rows[0].slug, 'mer_0099');
    assert.equal(rows[0].canRedeem, false);
    assert.equal(rows[0].hasJarExchangeMerchant, true);
    assert.equal(rows[0].city, '台北');
    assert.equal(rows[0].groomingDiscountAmount, GROOMING_COUPON_DISCOUNT_DEFAULT);
    assert.equal(rows[0].merchantRecordId, 'merchant_MER-0099');
    assert.equal(partnerStoreSourceKind(rows[0]), 'backend_only');
    assert.equal(partnerStoreSourceLabel.backend_only, '僅換罐後台');
    assert.deepEqual(partnerStoreStatusCopy(rows[0]), {
      label: '未開放核銷',
      tone: 'blocked',
    });
    assert.equal(partnerStoreExceptionLabel(rows[0]), '未開放核銷');
    assert.equal(partnerStoreNeedsIdentityNote(rows[0]), true);
  });

  it('merges by merchantToStoreSlug even when names differ', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [
        store({
          slug: 'mer_0018',
          name: '墨菲寵物美學（核銷）',
          groomingDiscountAmount: 200,
        }),
      ],
      merchants: [
        merchant({
          id: 'm_murphy',
          merchantId: 'MER-0018',
          name: '墨菲寵物美學',
          city: '新北',
          types: ['consignment', 'jar_exchange', 'partner'],
        }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'mer_0018');
    assert.equal(rows[0].name, '墨菲寵物美學（核銷）');
    assert.equal(rows[0].merchantName, '墨菲寵物美學');
    assert.equal(rows[0].namesDiffer, true);
    assert.equal(rows[0].canRedeem, true);
    assert.equal(rows[0].hasJarExchangeMerchant, true);
    assert.equal(rows[0].city, '新北');
    assert.deepEqual(rows[0].types, ['consignment', 'jar_exchange', 'partner']);
    assert.equal(rows[0].merchantRecordId, 'm_murphy');
    assert.equal(partnerStoreSourceKind(rows[0]), 'both');
    assert.equal(partnerStoreSourceLabel.both, '核銷＋後台');
    assert.deepEqual(partnerStoreStatusCopy(rows[0]), { label: '可核銷', tone: 'ok' });
    assert.equal(partnerStoreExceptionLabel(rows[0]), null);
    assert.equal(partnerStoreNeedsIdentityNote(rows[0]), true);
  });

  it('does not treat spacing-only name differences as a mismatch', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [store({ slug: 'zhuwo_zhonghe', name: '豬窩 中和店', groomingDiscountAmount: 250 })],
      merchants: [merchant({ merchantId: 'ZHUWO-ZHONGHE', name: '豬窩中和店', city: '新北' })],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].namesDiffer, false);
    assert.equal(rows[0].slug, merchantToStoreSlug('ZHUWO-ZHONGHE'));
    assert.equal(partnerStoreExceptionLabel(rows[0]), null);
    assert.equal(partnerStoreNeedsIdentityNote(rows[0]), false);
  });

  it('does not merge stores that only share a similar name', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [store({ slug: 'niuniu', name: '淡水妞妞', groomingDiscountAmount: 200 })],
      merchants: [merchant({ merchantId: 'MER-0001', name: '淡水妞妞', city: '新北' })],
    });
    assert.equal(rows.length, 2);
    const redeemOnly = rows.find((row) => row.slug === 'niuniu');
    const backendOnly = rows.find((row) => row.slug === 'mer_0001');
    assert.ok(redeemOnly);
    assert.ok(backendOnly);
    assert.equal(redeemOnly?.canRedeem, true);
    assert.equal(redeemOnly?.hasJarExchangeMerchant, false);
    assert.equal(backendOnly?.canRedeem, false);
    assert.equal(backendOnly?.hasJarExchangeMerchant, true);
  });

  it('keeps overlapping and one-sided rows in a mixed list', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [
        store({ slug: 'mer_0014', name: '柒沐寵物美容', groomingDiscountAmount: 200 }),
        store({ slug: 'pet99', name: '99寵物美容', groomingDiscountAmount: 200 }),
      ],
      merchants: [
        merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容', city: '台北' }),
        merchant({ merchantId: 'MER-0022', name: '只在後台的店', city: '桃園' }),
      ],
    });
    const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row]));
    assert.equal(rows.length, 3);
    assert.equal(bySlug.mer_0014.canRedeem, true);
    assert.equal(bySlug.mer_0014.hasJarExchangeMerchant, true);
    assert.equal(bySlug.pet99.canRedeem, true);
    assert.equal(bySlug.pet99.hasJarExchangeMerchant, false);
    assert.equal(bySlug.mer_0022.canRedeem, false);
    assert.equal(bySlug.mer_0022.hasJarExchangeMerchant, true);
    assert.deepEqual(partnerStoreDirectoryStats(rows, {
      storeSlugs: ['mer_0014', 'pet99'],
      merchantIds: ['MER-0014', 'MER-0022'],
    }), {
      total: 3,
      redeemableCount: 2,
      jarExchangeCount: 2,
      officialOneToOneCount: 1,
      needsReviewCount: 1,
    });
    assert.equal(partnerStoreExceptionLabel(bySlug.pet99), '待確認');
  });

  it('does not duplicate merchants that map to the same slug', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [],
      merchants: [
        merchant({ id: 'first', merchantId: 'MER-0030', name: '第一筆', city: '台北' }),
        merchant({ id: 'second', merchantId: 'mer-0030', name: '第二筆', city: '新北' }),
      ],
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].slug, 'mer_0030');
    assert.equal(rows[0].name, '第一筆');
  });

  it('uses Zhuwo grooming discount from the store row when merged', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [
        store({
          slug: 'zhuwo_banqiao',
          name: '豬窩 板橋店',
          groomingDiscountAmount: GROOMING_COUPON_DISCOUNT_ZHUWO,
        }),
      ],
      merchants: [merchant({ merchantId: 'ZHUWO-BANQIAO', name: '豬窩板橋店' })],
    });
    assert.equal(rows[0].groomingDiscountAmount, GROOMING_COUPON_DISCOUNT_ZHUWO);
  });

  it('merges HQ-confirmed slug and MER into one row and keeps Zhuwo as three stores', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [
        store({ slug: 'zhuwo_banqiao', name: '豬窩 板橋店', groomingDiscountAmount: GROOMING_COUPON_DISCOUNT_ZHUWO }),
        store({ slug: 'zhuwo_tucheng', name: '豬窩 土城店', groomingDiscountAmount: GROOMING_COUPON_DISCOUNT_ZHUWO }),
        store({ slug: 'zhuwo_zhonghe', name: '豬窩 中和店', groomingDiscountAmount: GROOMING_COUPON_DISCOUNT_ZHUWO }),
        store({ slug: 'niuniu', name: '淡水妞妞' }),
        store({ slug: 'manlisa', name: '曼利莎寵物美容' }),
        store({ slug: 'pet99', name: '99寵物美容' }),
        store({ slug: 'mer_0013', name: '泡泡堂' }),
        store({ slug: 'mer_0014', name: '柒沐寵物美容' }),
        store({ slug: 'mer_0018', name: '墨菲寵物美學' }),
      ],
      merchants: [
        merchant({ merchantId: 'MER-0019', name: '豬窩 板橋店', city: '新北' }),
        merchant({ merchantId: 'MER-0020', name: '豬窩 土城店', city: '新北' }),
        merchant({ merchantId: 'MER-0016', name: '豬窩 中和店', city: '新北' }),
        merchant({ merchantId: 'MER-0010', name: '淡水妞妞', city: '新北' }),
        merchant({ merchantId: 'MER-0017', name: '曼利莎寵物美容', city: '桃園' }),
        merchant({ merchantId: 'MER-0013', name: '泡泡堂' }),
        merchant({ merchantId: 'MER-0014', name: '柒沐寵物美容' }),
        merchant({ merchantId: 'MER-0018', name: '墨菲寵物美學' }),
        merchant({ merchantId: 'MER-OTHER', name: '錯誤店家對照（勿交付）' }),
        merchant({ merchantId: 'MER-REFILL', name: '匠寵換罐測試店' }),
        merchant({ merchantId: 'MER-DEMO', name: 'Furmosa Preview 店', types: ['flagship'] }),
      ],
    });
    const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row]));
    assert.equal(rows.length, 9);
    assert.equal(bySlug.zhuwo_banqiao.merchantId, 'MER-0019');
    assert.equal(bySlug.zhuwo_tucheng.merchantId, 'MER-0020');
    assert.equal(bySlug.zhuwo_zhonghe.merchantId, 'MER-0016');
    assert.equal(bySlug.niuniu.merchantId, 'MER-0010');
    assert.equal(bySlug.manlisa.merchantId, 'MER-0017');
    assert.equal(bySlug.zhuwo_banqiao.canRedeem, true);
    assert.equal(bySlug.zhuwo_banqiao.hasJarExchangeMerchant, true);
    assert.equal(Boolean(bySlug.mer_0019), false);
    assert.equal(Boolean(bySlug.mer_other), false);
    assert.equal(Boolean(bySlug.mer_refill), false);
    assert.equal(Boolean(bySlug.mer_demo), false);
    assert.equal(partnerStoreExceptionLabel(bySlug.pet99), '待確認');
    assert.deepEqual(
      partnerStoreDirectoryStats(rows, {
        storeSlugs: [
          'zhuwo_banqiao',
          'zhuwo_tucheng',
          'zhuwo_zhonghe',
          'niuniu',
          'manlisa',
          'pet99',
          'mer_0013',
          'mer_0014',
          'mer_0018',
        ],
        merchantIds: [
          'MER-0019',
          'MER-0020',
          'MER-0016',
          'MER-0010',
          'MER-0017',
          'MER-0013',
          'MER-0014',
          'MER-0018',
          'MER-OTHER',
          'MER-REFILL',
          'MER-DEMO',
        ],
      }),
      {
        total: 9,
        redeemableCount: 9,
        jarExchangeCount: 8,
        officialOneToOneCount: 8,
        needsReviewCount: 1,
      },
    );
  });

  it('infers Zhuwo discount for a backend-only 豬窩 merchant', () => {
    const rows = mergePartnerStoreDirectory({
      stores: [],
      merchants: [merchant({ merchantId: 'MER-0019', name: '豬窩土城店' })],
    });
    assert.equal(rows[0].groomingDiscountAmount, GROOMING_COUPON_DISCOUNT_ZHUWO);
  });
});
