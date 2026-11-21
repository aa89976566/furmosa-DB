import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildJarIntroMessages } from '../refill-intro-flex';

describe('LINE refill introduction Flex', () => {
  it('returns one compact text-only message with the approved content', async () => {
    const messages = await buildJarIntroMessages();
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.type, 'flex');

    const json = JSON.stringify(messages[0]);
    for (const expected of [
      '棒棒牛',
      '棒棒雞',
      '脆脆鴨',
      '5條／罐',
      '27g／罐',
      '到店換罐，每罐累積 1 點',
      '集滿 10 點，兌換 NT$200 店家折價券',
      '首罐不計點',
      '同一間店家',
      '棒棒雞不含鴨',
    ]) {
      assert.match(json, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const forbidden of ['"type":"image"', '"hero"', '7 種', '7種', '每兩週', '菜菜雞', '輪替', '每瓶']) {
      assert.doesNotMatch(json, new RegExp(forbidden));
    }

    assert.ok(Buffer.byteLength(json, 'utf8') <= 10 * 1024);
    if (messages[0]?.type === 'flex') {
      assert.ok(messages[0].altText.length <= 400);
      assert.equal((messages[0].contents as { type?: string }).type, 'bubble');
    }
  });
});
