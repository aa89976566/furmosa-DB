import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pickNiuniuMerchant } from '@/lib/pos/niuniu-merchant';

describe('pickNiuniuMerchant', () => {
  it('prefers 淡水妞妞 exact name', () => {
    const picked = pickNiuniuMerchant([
      { name: '豬窩中和' },
      { name: '妞妞寵物美容' },
      { name: '淡水妞妞' },
    ]);
    assert.equal(picked?.name, '淡水妞妞');
  });

  it('falls back to name containing 妞妞', () => {
    const picked = pickNiuniuMerchant([
      { name: '曼利莎' },
      { name: '台北妞妞分店' },
    ]);
    assert.equal(picked?.name, '台北妞妞分店');
  });

  it('returns null when empty', () => {
    assert.equal(pickNiuniuMerchant([]), null);
  });
});
