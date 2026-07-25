import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SIGNUP_REQUIRED_FOR_DEPOSIT_MESSAGE } from '@/lib/jar-exchange/location';
import { preferredRedeemSlugForMerchant } from '@/lib/stores/sync-merchant-stores';

describe('jar location helpers', () => {
  it('uses zhuwo fixed slug for 中和店', () => {
    assert.equal(
      preferredRedeemSlugForMerchant({
        merchantId: 'MER-0016',
        name: '豬窩 中和店',
      }),
      'zhuwo_zhonghe',
    );
  });

  it('maps MER-0014 to mer_0014', () => {
    assert.equal(
      preferredRedeemSlugForMerchant({
        merchantId: 'MER-0014',
        name: '柒沐寵物美容',
      }),
      'mer_0014',
    );
  });

  it('signup required message is Taiwan-facing', () => {
    assert.match(SIGNUP_REQUIRED_FOR_DEPOSIT_MESSAGE, /開戶/);
    assert.match(SIGNUP_REQUIRED_FOR_DEPOSIT_MESSAGE, /存罐/);
  });
});
