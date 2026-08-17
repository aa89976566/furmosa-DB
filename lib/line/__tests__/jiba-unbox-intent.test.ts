import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isJibaUnboxEntryIntent,
  JIBA_UNBOX_ENTRY_PHRASES,
  normalizeJibaUnboxKeyword,
} from '../campaigns/jiba-unbox/intent';
import { parseLineUserText } from '../parse-message';

const POSITIVE: Array<{ raw: string; note: string }> = [
  { raw: '開箱', note: 'bare' },
  { raw: '  開箱  ', note: 'trim' },
  { raw: '開箱！', note: 'punctuation' },
  { raw: '開箱。', note: 'fullwidth stop' },
  { raw: '開箱？', note: 'fullwidth question' },
  { raw: '開　箱', note: 'fullwidth space' },
  { raw: '開箱文', note: 'phrase' },
  { raw: '開箱任務', note: 'menu' },
  { raw: '開箱 任務', note: 'inner space' },
  { raw: 'ugc', note: 'lower' },
  { raw: 'UGC', note: 'upper' },
  { raw: 'Ugc', note: 'mixed case' },
  { raw: 'ＵＧＣ', note: 'fullwidth latin' },
  { raw: ' ugc ', note: 'ugc trim' },
  { raw: '試吃開箱', note: 'phrase' },
  { raw: '試吃 開箱', note: 'space between' },
  { raw: '開箱合作', note: 'phrase' },
  { raw: '合作開箱', note: 'phrase reverse' },
  { raw: '毛孩來開箱', note: 'legacy' },
  { raw: '來開箱', note: 'legacy' },
  { raw: '開箱研究', note: 'legacy' },
  { raw: '開箱\u200b任務', note: 'zero-width' },
];

const NEGATIVE: Array<{ raw: string; note: string }> = [
  { raw: '合作', note: 'bare 合作' },
  { raw: '試吃', note: 'bare 試吃' },
  { raw: '查看合作店', note: 'jar stores' },
  { raw: '合作店家', note: 'jar stores alias' },
  { raw: '合作美容店', note: 'partner store' },
  { raw: '我想合作', note: 'unrelated 合作' },
  { raw: '品牌合作提案', note: 'unrelated 合作' },
  { raw: '試吃看看', note: 'unrelated 試吃' },
  { raw: '這次試吃很開心', note: 'unrelated 試吃' },
  { raw: '開箱文案請幫我改', note: 'contains 開箱文 but longer' },
  { raw: '我想開箱', note: 'prefix chatter' },
  { raw: '開箱合作店', note: 'longer than 開箱合作' },
  { raw: '嗷嗚計劃', note: 'frog project' },
  { raw: '青蛙誰在怕', note: 'frog project' },
  { raw: '活動中心', note: 'events' },
  { raw: '換罐計劃', note: 'jar hub' },
  { raw: '介紹', note: 'jar intro' },
  { raw: '我要參加', note: 'join button, not entry' },
  { raw: '先不用', note: 'decline button' },
  { raw: '雞霸', note: 'product, not entry' },
  { raw: '', note: 'empty' },
  { raw: '   ', note: 'whitespace' },
];

describe('normalizeJibaUnboxKeyword', () => {
  it('strips case, width, space and punctuation', () => {
    assert.equal(normalizeJibaUnboxKeyword('  ＵＧＣ！ '), 'ugc');
    assert.equal(normalizeJibaUnboxKeyword('開箱　任務。'), '開箱任務');
    assert.equal(normalizeJibaUnboxKeyword('開箱\u200b'), '開箱');
  });
});

describe('isJibaUnboxEntryIntent table', () => {
  it('lists the required phrases', () => {
    for (const phrase of ['開箱', '開箱文', '開箱任務', 'ugc', '試吃開箱', '開箱合作', '合作開箱']) {
      assert.ok(
        (JIBA_UNBOX_ENTRY_PHRASES as readonly string[]).includes(phrase),
        `missing ${phrase}`,
      );
    }
  });

  for (const { raw, note } of POSITIVE) {
    it(`hits: ${JSON.stringify(raw)} (${note})`, () => {
      assert.equal(isJibaUnboxEntryIntent(raw), true);
    });
  }

  for (const { raw, note } of NEGATIVE) {
    it(`misses: ${JSON.stringify(raw)} (${note})`, () => {
      assert.equal(isJibaUnboxEntryIntent(raw), false);
    });
  }
});

describe('parseLineUserText does not steal other campaigns', () => {
  it('keeps frog / jar / events kinds', () => {
    assert.equal(parseLineUserText('嗷嗚計劃').kind, 'unboxing');
    assert.equal(parseLineUserText('青蛙誰在怕').kind, 'unboxing');
    assert.equal(parseLineUserText('查看合作店').kind, 'jar_stores');
    assert.equal(parseLineUserText('合作店家').kind, 'jar_stores');
    assert.equal(parseLineUserText('活動中心').kind, 'events_center');
    assert.equal(parseLineUserText('試吃').kind, 'unknown');
    assert.equal(parseLineUserText('合作').kind, 'unknown');
    assert.equal(parseLineUserText('我想合作').kind, 'unknown');
  });
});
