import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { REFILL_INTRO_COPY, REFILL_INTRO_PRODUCTS, REFILL_PLAN_FAQ } from '@/lib/jar-exchange/refill-plan-content';
import { JAR_EXPLAIN_DIALOGUE, JAR_FLOW_STORY } from '@/lib/line/brand-worlds';

describe('LINE 換罐文案一致性', () => {
  it('只介紹目前三款換罐內容', () => {
    assert.deepEqual(
      REFILL_INTRO_PRODUCTS.map((item) => item.name),
      ['棒棒牛', '棒棒雞', '脆脆鴨'],
    );
  });

  it('所有主要入口都使用相同集點規則', () => {
    const copy = JSON.stringify({
      intro: REFILL_INTRO_COPY,
      faq: REFILL_PLAN_FAQ,
      dialogue: JAR_EXPLAIN_DIALOGUE,
      flow: JAR_FLOW_STORY,
    });
    assert.ok(copy.includes('第一罐 NT$129'));
    assert.ok(copy.includes('NT$99 續罐'));
    assert.match(copy, /完整空罐/);
    assert.match(copy, /口味都可以改選|其他口味/);
    assert.match(copy, /首罐不計點/);
    assert.match(copy, /完成到店換罐|到店換罐/);
    assert.match(copy, /10 點/);
    assert.ok(copy.includes('NT$200'));
    assert.match(copy, /同一間/);
    assert.doesNotMatch(copy, /菜菜雞|7 種|每兩週|毛孩去美容|美容店確認預約|金額依.*門市/);
  });
});
