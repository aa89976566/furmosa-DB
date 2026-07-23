import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  QIMU_DELIVERY_ADDRESS,
  isQimuMerchantName,
} from '../stores/ensure-qimu-delivery';

describe('isQimuMerchantName', () => {
  it('matches 柒沐／柒木 variants', () => {
    assert.equal(isQimuMerchantName('柒沐寵物美容'), true);
    assert.equal(isQimuMerchantName('淡水柒木寵物美容'), true);
    assert.equal(isQimuMerchantName('淡水妞妞'), false);
  });
});

describe('QIMU_DELIVERY_ADDRESS', () => {
  it('uses 淡水北新路店址', () => {
    assert.equal(QIMU_DELIVERY_ADDRESS, '新北市淡水區北新路218號');
  });
});
