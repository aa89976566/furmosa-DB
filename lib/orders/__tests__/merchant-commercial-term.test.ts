import assert from 'node:assert/strict';
import test from 'node:test';
import {
  businessTierLabel,
  commercialRuleSourceLabel,
  commercialTermValueLabel,
  resolveMerchantCommercialTerm,
} from '../merchant-commercial-term.ts';

const product = {
  businessTier: 'standard',
  commercialTermsVersion: 3,
  defaultConsignmentCommissionMode: 'percent',
  defaultConsignmentCommissionValue: 2000,
  defaultWholesaleUnitPrice: 70,
};

test('寄賣使用 SKU 預設並把比例保存為 basis points', () => {
  const result = resolveMerchantCommercialTerm({
    orderMode: 'consignment', product, tier: null, merchantException: null, override: null,
  });
  assert.equal(result.commercialRuleSource, 'product_default');
  assert.equal(result.appliedCommercialMode, 'percent');
  assert.equal(result.appliedCommercialValue, 2000);
  assert.equal(result.businessTierSnapshot, 'standard');
  assert.equal(result.commercialTermsVersionSnapshot, 3);
});

test('店家寄賣特約優先於 SKU 預設，舊百分比轉為 basis points', () => {
  const result = resolveMerchantCommercialTerm({
    orderMode: 'consignment',
    product,
    tier: null,
    merchantException: { mode: 'percent', value: 25 },
    override: null,
  });
  assert.equal(result.commercialRuleSource, 'merchant_exception');
  assert.equal(result.defaultCommercialValue, 2500);
});

test('買斷先用店家規格特約，再用規格與 SKU 預設', () => {
  const exception = resolveMerchantCommercialTerm({
    orderMode: 'wholesale',
    product,
    tier: { defaultWholesaleUnitPrice: 65 },
    merchantException: { mode: 'fixed_price', value: 60 },
    override: null,
  });
  assert.equal(exception.commercialRuleSource, 'merchant_exception');
  assert.equal(exception.appliedCommercialValue, 60);

  const tierDefault = resolveMerchantCommercialTerm({
    orderMode: 'wholesale',
    product,
    tier: { defaultWholesaleUnitPrice: 65 },
    merchantException: null,
    override: null,
  });
  assert.equal(tierDefault.commercialRuleSource, 'product_default');
  assert.equal(tierDefault.appliedCommercialValue, 65);
});

test('本單覆寫優先且必須留下原因', () => {
  const result = resolveMerchantCommercialTerm({
    orderMode: 'consignment',
    product,
    tier: null,
    merchantException: null,
    override: { mode: 'percent', value: 1800, reason: '開幕首批優惠' },
  });
  assert.equal(result.commercialRuleSource, 'order_override');
  assert.equal(result.defaultCommercialValue, 2000);
  assert.equal(result.appliedCommercialValue, 1800);
  assert.equal(result.commercialOverrideReason, '開幕首批優惠');
  assert.equal(result.isOverride, true);
});

test('覆寫沒有原因、格式錯誤或缺少必要預設時拒絕', () => {
  assert.throws(() => resolveMerchantCommercialTerm({
    orderMode: 'consignment', product, tier: null, merchantException: null,
    override: { mode: 'percent', value: 1800, reason: '優惠' },
  }), /至少 4 個字/);
  assert.throws(() => resolveMerchantCommercialTerm({
    orderMode: 'consignment', product, tier: null, merchantException: null,
    override: { mode: 'amount', value: 50, reason: '特殊合作條件' },
  }), /格式不正確/);
  assert.throws(() => resolveMerchantCommercialTerm({
    orderMode: 'wholesale',
    product: { ...product, defaultWholesaleUnitPrice: null },
    tier: null,
    merchantException: null,
    override: null,
  }), /尚未設定買斷進貨價/);
  assert.throws(() => resolveMerchantCommercialTerm({
    orderMode: 'wholesale',
    product,
    tier: null,
    merchantException: { mode: 'fixed_price', value: 60.5 },
    override: null,
  }), /整數台幣/);
  assert.throws(() => resolveMerchantCommercialTerm({
    orderMode: 'consignment',
    product,
    tier: null,
    merchantException: { mode: 'unknown', value: 20 },
    override: null,
  }), /特約格式不正確/);
});

test('換罐不套一般商務條件，也不接受覆寫', () => {
  const result = resolveMerchantCommercialTerm({
    orderMode: 'jar_exchange', product, tier: null, merchantException: null, override: null,
  });
  assert.equal(result.appliedCommercialMode, null);
  assert.throws(() => resolveMerchantCommercialTerm({
    orderMode: 'jar_exchange', product, tier: null, merchantException: null,
    override: { mode: 'amount', value: 10, reason: '不應套用條件' },
  }), /換罐計畫/);
});

test('商務快照標籤使用可直接理解的名稱與金額格式', () => {
  assert.equal(businessTierLabel('standard'), '一般商品');
  assert.equal(businessTierLabel('premium'), 'Premium Product');
  assert.equal(commercialRuleSourceLabel('product_default'), 'SKU 預設');
  assert.equal(commercialRuleSourceLabel('merchant_exception'), '店家特約');
  assert.equal(commercialRuleSourceLabel('order_override'), '本單調整');
  assert.equal(commercialTermValueLabel('percent', 2050), '20.50%');
  assert.equal(commercialTermValueLabel('fixed_price', 70), 'NT$ 70');
});
