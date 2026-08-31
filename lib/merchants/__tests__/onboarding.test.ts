import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  isLikelyDuplicateMerchant,
  mergeMerchantTypes,
  normalizeMerchantName,
  selectedCooperationTypes,
} from '@/lib/merchants/onboarding';

describe('merchant onboarding rules', () => {
  it('normalizes spacing and case before duplicate checks', () => {
    assert.equal(normalizeMerchantName('  毛孩 生活  '), normalizeMerchantName('毛孩生活'));
  });

  it('treats the same store name or phone as a likely duplicate', () => {
    assert.equal(
      isLikelyDuplicateMerchant(
        { name: '毛孩生活', phone: '0912-345-678' },
        { name: '其他名稱', phone: '0912345678' },
      ),
      true,
    );
  });

  it('adds cooperation types without removing existing tags', () => {
    assert.deepEqual(
      mergeMerchantTypes(['partner', 'consignment'], ['jar_exchange', 'consignment']),
      ['partner', 'consignment', 'jar_exchange'],
    );
  });

  it('accepts only cooperation types from onboarding', () => {
    assert.deepEqual(selectedCooperationTypes(['wholesale', 'flagship', 'jar_exchange']), [
      'wholesale',
      'jar_exchange',
    ]);
  });
});
