import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FLOW_STATE } from '@/lib/campaigns/jiba-two-piece/constants';
import {
  JIBA_UNBOX_INTENT_PHRASES,
  isJibaInviteDecline,
  isJibaUnboxIntent,
  normalizeJibaUnboxIntentText,
  resolveJibaUnboxTurn,
} from '@/lib/line/campaigns/jiba-unbox/intent';
import {
  buildJibaInviteFlex,
  buildJibaProductChoiceMenu,
  jibaProductButtonLabels,
  jibaProductButtonPayloads,
} from '@/lib/line/campaigns/jiba-unbox/menus';
import { parseLineUserText } from '@/lib/line/parse-message';
import { isUnboxLeaveText } from '@/lib/line/session-leave';
import { jibaBriefAndUpsell, JIBA_INVITE_BODY, JIBA_INVITE_TITLE } from '@/lib/campaigns/jiba-two-piece/copy';
import { validRecipientName } from '@/lib/campaigns/jiba-two-piece/validation';

const POSITIVE = [
  '開箱',
  '開箱文',
  '開箱任務',
  'ugc',
  'UGC',
  '試吃開箱',
  '開箱合作',
  '合作開箱',
  '毛孩來開箱',
  '來開箱',
  '開箱研究',
];

const NORMALIZED_POSITIVES: Array<[string, string]> = [
  ['  開箱  ', '開箱'],
  ['開箱！', '開箱'],
  ['開箱。', '開箱'],
  ['開箱？', '開箱'],
  ['開箱\u200b', '開箱'],
  ['ＵＧＣ', 'ugc'],
  ['ｕｇｃ', 'ugc'],
  ['開 箱 任 務', '開箱任務'],
  ['試吃開箱!', '試吃開箱'],
  ['合作開箱…', '合作開箱'],
];

const NEGATIVE = [
  '查看合作店',
  '合作店家',
  '合作美容店',
  '我想合作',
  '品牌合作',
  '試吃',
  '去試吃',
  '試吃看看',
  '嗷嗚計劃',
  '嗷嗚計畫',
  '青蛙誰在怕',
  '活動中心',
  '換罐計劃',
  '介紹',
  '今天天氣不錯',
  '開箱任務很有趣吧',
  '我想開箱給你看長文',
];

describe('jiba unbox intent matcher', () => {
  it('lists the required phrases', () => {
    for (const phrase of ['開箱', '開箱文', '開箱任務', 'ugc', '試吃開箱', '開箱合作', '合作開箱']) {
      assert.ok(JIBA_UNBOX_INTENT_PHRASES.includes(phrase as (typeof JIBA_UNBOX_INTENT_PHRASES)[number]));
    }
  });

  it('accepts exact keywords after normalization', () => {
    for (const text of POSITIVE) {
      assert.equal(isJibaUnboxIntent(text), true, text);
      assert.equal(parseLineUserText(text).kind, 'jiba_unbox', text);
    }
  });

  it('normalizes case, spaces, fullwidth and surrounding punctuation', () => {
    for (const [raw, expected] of NORMALIZED_POSITIVES) {
      assert.equal(normalizeJibaUnboxIntentText(raw), expected, raw);
      assert.equal(isJibaUnboxIntent(raw), true, raw);
      assert.equal(parseLineUserText(raw).kind, 'jiba_unbox', raw);
    }
  });

  it('does not fuzzy-match 合作 or 試吃 or other activities', () => {
    for (const text of NEGATIVE) {
      assert.equal(isJibaUnboxIntent(text), false, text);
      assert.notEqual(parseLineUserText(text).kind, 'jiba_unbox', text);
    }
    assert.equal(parseLineUserText('嗷嗚計劃').kind, 'unboxing');
    assert.equal(parseLineUserText('青蛙誰在怕').kind, 'unboxing');
    assert.equal(parseLineUserText('查看合作店').kind, 'jar_stores');
  });
});

describe('jiba unbox entry state sequence', () => {
  it('keyword without session → invite only', () => {
    const turn = resolveJibaUnboxTurn({
      sessionActive: false,
      currentState: null,
      hasApplication: false,
      text: '開箱',
    });
    assert.deepEqual(turn, { kind: 'invite' });
  });

  it('invite → 我要參加 → join; 先不用 → decline', () => {
    assert.deepEqual(
      resolveJibaUnboxTurn({
        sessionActive: true,
        currentState: FLOW_STATE.CAMPAIGN_INTRO,
        hasApplication: false,
        text: '我要參加',
      }),
      { kind: 'join' },
    );
    assert.deepEqual(
      resolveJibaUnboxTurn({
        sessionActive: true,
        currentState: FLOW_STATE.CAMPAIGN_INTRO,
        hasApplication: false,
        text: '先不用',
      }),
      { kind: 'decline' },
    );
  });

  it('join then three product buttons then brief continue', () => {
    const picks = [
      ['選雞霸兩片', 'jiba'],
      ['選青蛙凍乾', 'frog'],
      ['選貓草雞肉乾', 'catnip'],
    ] as const;
    for (const [text, productKey] of picks) {
      assert.deepEqual(
        resolveJibaUnboxTurn({
          sessionActive: true,
          currentState: FLOW_STATE.ASK_PRODUCT,
          hasApplication: true,
          text,
        }),
        { kind: 'pick_product', productKey },
      );
    }
    assert.deepEqual(
      resolveJibaUnboxTurn({
        sessionActive: true,
        currentState: FLOW_STATE.SHOW_BRIEF,
        hasApplication: true,
        text: '好，開始填資料',
      }),
      { kind: 'brief_continue' },
    );
    assert.deepEqual(
      resolveJibaUnboxTurn({
        sessionActive: true,
        currentState: FLOW_STATE.SHOW_BRIEF,
        hasApplication: true,
        text: '我了解用途，開始填資料',
      }),
      { kind: 'brief_continue' },
    );
  });

  it('resending keyword in an active session only re-prompts', () => {
    for (const state of [
      FLOW_STATE.CAMPAIGN_INTRO,
      FLOW_STATE.ASK_PRODUCT,
      FLOW_STATE.SHOW_BRIEF,
      FLOW_STATE.ASK_RECIPIENT_NAME,
    ]) {
      assert.deepEqual(
        resolveJibaUnboxTurn({
          sessionActive: true,
          currentState: state,
          hasApplication: true,
          text: '開箱任務',
        }),
        { kind: 'reprompt', state },
      );
    }
    assert.equal(isUnboxLeaveText('開箱任務'), false);
    assert.equal(isUnboxLeaveText('開箱'), false);
  });

  it('先不用 cancels leftover collecting drafts', () => {
    assert.equal(isJibaInviteDecline('先不用'), true);
    assert.deepEqual(
      resolveJibaUnboxTurn({
        sessionActive: false,
        currentState: null,
        hasApplication: true,
        text: '先不用',
      }),
      { kind: 'decline' },
    );
  });
});

describe('jiba unbox invite and product menus', () => {
  it('invite flex is a single decision without products or catnip url', () => {
    const flex = buildJibaInviteFlex();
    const raw = JSON.stringify(flex);
    assert.match(raw, new RegExp(JIBA_INVITE_TITLE));
    assert.match(raw, /真實開箱與試吃反應/);
    assert.match(raw, /我要參加/);
    assert.match(raw, /先不用/);
    assert.doesNotMatch(raw, /選雞霸兩片|選青蛙凍乾|選貓草雞肉乾/);
    assert.doesNotMatch(raw, /catnip-chick/);
    assert.doesNotMatch(raw, /先看看規則/);
    assert.ok(JIBA_INVITE_BODY.includes('審核'));
  });

  it('product menu has three button labels and safe payloads', () => {
    assert.deepEqual(jibaProductButtonLabels(), ['雞霸', '青蛙', '貓草雞肉乾 30g']);
    assert.deepEqual(jibaProductButtonPayloads(), ['選雞霸兩片', '選青蛙凍乾', '選貓草雞肉乾']);
    const raw = JSON.stringify(buildJibaProductChoiceMenu());
    assert.match(raw, /雞霸/);
    assert.match(raw, /青蛙/);
    assert.match(raw, /貓草雞肉乾 30g/);
    assert.match(raw, /選雞霸兩片/);
    for (const payload of jibaProductButtonPayloads()) {
      assert.equal(validRecipientName(payload), null);
    }
  });

  it('only catnip brief mentions the homepage purpose', () => {
    assert.match(jibaBriefAndUpsell('catnip'), /catnip-chick\.vercel\.app\/\?cat=1/);
    assert.doesNotMatch(jibaBriefAndUpsell('jiba'), /catnip-chick/);
    assert.doesNotMatch(jibaBriefAndUpsell('frog'), /catnip-chick/);
  });
});
