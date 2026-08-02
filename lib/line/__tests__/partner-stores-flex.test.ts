import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildPartnerStoresMessages } from '../partner-stores-flex';

describe('buildPartnerStoresMessages', () => {
  it('空清單給溫柔提示', () => {
    const msgs = buildPartnerStoresMessages([]);
    assert.equal(msgs[0]?.type, 'text');
    assert.match(JSON.stringify(msgs), /整理/);
  });

  it('多店用 carousel：故事卡＋分區，不含錯誤店家對照文案', () => {
    const msgs = buildPartnerStoresMessages([
      {
        id: '1',
        slug: 'zhuwo_banqiao',
        name: '豬窩 板橋店',
        groomingDiscountAmount: 250,
      },
      {
        id: '2',
        slug: 'niuniu',
        name: '淡水妞妞',
        groomingDiscountAmount: 200,
      },
      {
        id: '3',
        slug: 'mer_0014',
        name: '柒沐寵物美容',
        groomingDiscountAmount: 200,
      },
    ]);
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]?.type, 'flex');
    const raw = JSON.stringify(msgs);
    assert.match(raw, /carousel/);
    assert.match(raw, /空罐回來的地方/);
    assert.match(raw, /新北據點/);
    assert.match(raw, /豬窩 板橋店/);
    assert.match(raw, /幫毛孩開戶/);
    assert.doesNotMatch(raw, /錯誤店家/);
    assert.doesNotMatch(raw, /勿交付/);
  });
});
