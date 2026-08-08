import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isContentSendable, mapContentRow } from '../content';
import { assertNoPromo, renderJokeMessage, renderNewsMessage } from '../renderer';

describe('morning renderer + content rules', () => {
  it('笑話 ≤80 字且無促銷', () => {
    const r = renderJokeMessage({
      body: '早餐時牠盯著吐司，像在審核我的人生選擇。結果審核沒過，改咬鞋帶。',
    });
    assert.ok(r.charCount <= 80);
    assert.equal(assertNoPromo(r.text), true);
  });

  it('新聞附來源與原文連結', () => {
    const r = renderNewsMessage({
      factSummary: '動物園為水獺增加漂浮玩具，探索時間變長。',
      barkLine: '玩具一丟下水，認真程度瞬間像開會。',
      sourceName: '臺北市立動物園',
      canonicalUrl: 'https://zoo.taipei.gov.tw/news/x',
    });
    assert.match(r.text, /來源：臺北市立動物園/);
    assert.match(r.text, /https:\/\/zoo\.taipei\.gov\.tw\/news\/x/);
  });

  it('DRAFT／ARCHIVED 永不 sendable；APPROVED 才可，cooldown 生效', () => {
    const draft = mapContentRow({
      id: '1',
      stableId: 'x',
      kind: 'joke',
      status: 'DRAFT',
      body: 'hi',
      petTags: '[]',
      cooldownDays: 14,
      lastUsedAt: null,
    });
    assert.equal(isContentSendable(draft), false);

    const archived = { ...draft, status: 'ARCHIVED' };
    assert.equal(isContentSendable(archived), false);

    const approved = { ...draft, status: 'APPROVED' };
    assert.equal(isContentSendable(approved), true);

    const used = {
      ...approved,
      lastUsedAt: new Date(),
      cooldownDays: 14,
    };
    assert.equal(isContentSendable(used), false);
  });
});
