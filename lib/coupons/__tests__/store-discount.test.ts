import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GROOMING_COUPON_DISCOUNT_DEFAULT,
  GROOMING_COUPON_DISCOUNT_ZHUWO,
  getGroomingCouponDiscountForStore,
  getGroomingCouponTypeForDiscount,
  isZhuwoPartnerStore,
} from '@/lib/coupons/store-discount';

describe('grooming coupon store discount', () => {
  it('identifies zhuwo stores by slug prefix', () => {
    assert.equal(isZhuwoPartnerStore('zhuwo_zhonghe'), true);
    assert.equal(isZhuwoPartnerStore('zhuwo_banqiao', '板橋店'), true);
    assert.equal(isZhuwoPartnerStore('zhuwo_tucheng'), true);
  });

  it('identifies zhuwo stores by mer_0016 slug', () => {
    assert.equal(isZhuwoPartnerStore('mer_0016'), true);
    assert.equal(isZhuwoPartnerStore('MER_0016'), true);
  });

  it('identifies zhuwo stores by name', () => {
    assert.equal(isZhuwoPartnerStore('unknown_slug', '豬窩 中和店'), true);
    assert.equal(isZhuwoPartnerStore('custom', '豬窩'), true);
  });

  it('returns 250 for zhuwo and 200 for other partner stores', () => {
    assert.equal(
      getGroomingCouponDiscountForStore('zhuwo_zhonghe', '豬窩 中和店'),
      GROOMING_COUPON_DISCOUNT_ZHUWO,
    );
    assert.equal(
      getGroomingCouponDiscountForStore('mer_0016', '豬窩'),
      GROOMING_COUPON_DISCOUNT_ZHUWO,
    );
    assert.equal(
      getGroomingCouponDiscountForStore('niuniu', '淡水妞妞'),
      GROOMING_COUPON_DISCOUNT_DEFAULT,
    );
    assert.equal(
      getGroomingCouponDiscountForStore('manlisa', '曼利莎寵物美容'),
      GROOMING_COUPON_DISCOUNT_DEFAULT,
    );
    assert.equal(
      getGroomingCouponDiscountForStore('mer_0018', '墨菲寵物美學'),
      GROOMING_COUPON_DISCOUNT_DEFAULT,
    );
    assert.equal(
      getGroomingCouponDiscountForStore('pet99', '99寵物美容'),
      GROOMING_COUPON_DISCOUNT_DEFAULT,
    );
  });

  it('maps discount amount to coupon type', () => {
    assert.equal(getGroomingCouponTypeForDiscount(250), 'grooming_250');
    assert.equal(getGroomingCouponTypeForDiscount(200), 'grooming_200');
  });
});
