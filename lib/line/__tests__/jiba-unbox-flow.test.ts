import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FLOW_STATE, JIBA_SHIPPING_FEE } from '../../campaigns/jiba-two-piece/constants';
import {
  JIBA_INVITE_ALT_TEXT,
  JIBA_INVITE_BODY,
  JIBA_INVITE_DECLINE,
  JIBA_INVITE_JOIN,
  JIBA_INVITE_TITLE,
  JIBA_UPSELL_ACCEPT,
  JIBA_UPSELL_BODY,
  JIBA_UPSELL_SKIP,
  jibaProductBrief,
} from '../../campaigns/jiba-two-piece/copy';
import { JIBA_COLLECTING_SEQUENCE } from '../../campaigns/jiba-two-piece/shipping';
import { validRecipientName } from '../../campaigns/jiba-two-piece/validation';
import {
  jibaInviteMenu,
  jibaInviteMessages,
  jibaProductChoiceMenu,
  jibaProductChoiceMessages,
  jibaUpsellMenu,
  jibaUpsellMessages,
} from '../campaigns/jiba-unbox/menus';
import {
  decideJibaUnboxEntry,
  decideJibaUnboxMessage,
} from '../campaigns/jiba-unbox/turns';
import type { LineReplyMessage } from '../reply';

function flexRaw(msg: LineReplyMessage) {
  if (msg.type === 'flex') return JSON.stringify(msg.contents);
  return JSON.stringify(msg);
}

const INVITE_FEE_SURFACES: Array<{ name: string; text: string }> = [
  { name: 'title+body', text: `${JIBA_INVITE_TITLE}\n${JIBA_INVITE_BODY}` },
  { name: 'altText', text: JIBA_INVITE_ALT_TEXT },
  { name: 'flex', text: '' },
];

describe('jiba invite / product menus', () => {
  it('invite is a single Flex message', () => {
    const messages = jibaInviteMessages();
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.type, 'flex');
    const raw = flexRaw(jibaInviteMenu());
    assert.match(raw, new RegExp(JIBA_INVITE_TITLE));
    assert.match(raw, new RegExp(JIBA_INVITE_BODY.slice(0, 8)));
    assert.match(raw, new RegExp(JIBA_INVITE_JOIN));
    assert.match(raw, new RegExp(JIBA_INVITE_DECLINE));
    assert.doesNotMatch(raw, /先看看規則|授權|399|886|catnip-chick|選雞霸|選青蛙/);
    assert.equal((raw.match(/"type":"button"/g) ?? []).length, 2);
  });

  for (const surface of INVITE_FEE_SURFACES) {
    it(`shows ${JIBA_SHIPPING_FEE} 元物流處理費 on invite ${surface.name} before 我要參加`, () => {
      const text = surface.name === 'flex' ? flexRaw(jibaInviteMenu()) : surface.text;
      assert.match(text, new RegExp(`${JIBA_SHIPPING_FEE}\\s*元物流處理費`));
      assert.match(text, /需自付/);
      assert.match(text, /審核/);
      assert.match(text, /寄出/);
      assert.doesNotMatch(text, /可能.*運費|運費另計|運費另計|可能需自付/);
      const feeAt = text.search(new RegExp(`${JIBA_SHIPPING_FEE}\\s*元物流處理費`));
      const joinAt = text.indexOf(JIBA_INVITE_JOIN);
      assert.ok(feeAt >= 0, 'fee missing');
      if (joinAt >= 0) assert.ok(joinAt > feeAt, 'fee must appear before 我要參加');
    });
  }

  it('ASK_PRODUCT is a single Flex/button message', () => {
    const messages = jibaProductChoiceMessages();
    assert.equal(messages.length, 1);
    assert.equal(messages[0]?.type, 'flex');
    const raw = flexRaw(jibaProductChoiceMenu());
    assert.match(raw, /"text":"選雞霸"/);
    assert.match(raw, /"text":"選青蛙"/);
    assert.match(raw, /"text":"選貓草雞肉乾"/);
    assert.match(raw, /"label":"雞霸"/);
    assert.match(raw, /"label":"青蛙"/);
    assert.match(raw, /貓草雞肉乾 30g/);
    assert.equal((raw.match(/"type":"button"/g) ?? []).length, 3);
    assert.equal(validRecipientName('選雞霸'), null);
    assert.equal(validRecipientName('選青蛙'), null);
    assert.equal(validRecipientName('選貓草雞肉乾'), null);
  });

  it('flow replies for invite and ASK_PRODUCT go through the single-message builders', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../campaigns/jiba-unbox/flow.ts', import.meta.url), 'utf8');
    assert.match(src, /jibaInviteMessages\(\)/);
    assert.match(src, /jibaProductChoiceMessages\(\)/);
    assert.match(src, /jibaUpsellMessages\(\)/);
    assert.doesNotMatch(src, /jibaInviteMenu\(\)/);
    assert.doesNotMatch(src, /jibaProductChoiceMenu\(\)/);
    assert.doesNotMatch(
      src,
      /type:\s*'text'[\s\S]{0,80}jibaProductChoice/,
    );
    assert.match(src, /FLOW_STATE\.ASK_UPSELL/);
    assert.match(src, /setConversationState\(sid, FLOW_STATE\.ASK_UPSELL/);
    assert.doesNotMatch(
      src,
      /setConversationState\(sid, FLOW_STATE\.ASK_INSTAGRAM, \{\s*storeName/,
    );
  });

  it('upsell menu is a single Flex after shipping copy', () => {
    const messages = jibaUpsellMessages();
    assert.equal(messages.length, 1);
    const raw = flexRaw(jibaUpsellMenu());
    assert.match(raw, new RegExp(JIBA_UPSELL_SKIP));
    assert.match(raw, new RegExp(JIBA_UPSELL_ACCEPT));
    assert.match(raw, /399/);
    assert.match(raw, /886/);
    assert.match(raw, new RegExp(`${JIBA_SHIPPING_FEE}\\s*元物流處理費`));
    assert.match(JIBA_UPSELL_BODY, /收件資訊齊了|要加購/);
  });
});

describe('jiba entry routing', () => {
  it('no session → invite', () => {
    assert.deepEqual(
      decideJibaUnboxEntry({
        sessionActive: false,
        pausedForRegister: false,
        hasApplication: false,
        state: null,
      }),
      { action: 'invite' },
    );
  });

  it('active session → replay current step', () => {
    assert.deepEqual(
      decideJibaUnboxEntry({
        sessionActive: true,
        pausedForRegister: false,
        hasApplication: true,
        state: FLOW_STATE.ASK_RECIPIENT_NAME,
      }),
      { action: 'replay', state: FLOW_STATE.ASK_RECIPIENT_NAME },
    );
  });

  it('paused for register → resume choice, not reset', () => {
    assert.deepEqual(
      decideJibaUnboxEntry({
        sessionActive: false,
        pausedForRegister: true,
        hasApplication: true,
        state: FLOW_STATE.ASK_STORE,
      }),
      { action: 'resume_choice' },
    );
  });
});

describe('jiba state sequence', () => {
  it('keyword → invite → 我要參加 → 三按鈕選品 → 品項說明 → 收件', () => {
    const idle = {
      sessionActive: false,
      pausedForRegister: false,
      hasApplication: false,
      state: null,
    };
    assert.deepEqual(decideJibaUnboxMessage({ ...idle, text: '開箱' }), {
      action: 'invite',
    });
    assert.deepEqual(decideJibaUnboxMessage({ ...idle, text: 'UGC' }), {
      action: 'invite',
    });

    const intro = {
      sessionActive: true,
      pausedForRegister: false,
      hasApplication: false,
      state: FLOW_STATE.CAMPAIGN_INTRO,
    };
    assert.deepEqual(decideJibaUnboxMessage({ ...intro, text: '我要參加' }), {
      action: 'join',
    });

    const askProduct = {
      sessionActive: true,
      pausedForRegister: false,
      hasApplication: true,
      state: FLOW_STATE.ASK_PRODUCT,
    };
    assert.deepEqual(decideJibaUnboxMessage({ ...askProduct, text: '選雞霸' }), {
      action: 'pick_product',
      productKey: 'jiba',
    });
    assert.deepEqual(decideJibaUnboxMessage({ ...askProduct, text: '選青蛙' }), {
      action: 'pick_product',
      productKey: 'frog',
    });
    assert.deepEqual(decideJibaUnboxMessage({ ...askProduct, text: '選貓草雞肉乾' }), {
      action: 'pick_product',
      productKey: 'catnip',
    });

    const brief = {
      sessionActive: true,
      pausedForRegister: false,
      hasApplication: true,
      state: FLOW_STATE.SHOW_BRIEF,
    };
    assert.deepEqual(decideJibaUnboxMessage({ ...brief, text: '好，開始填資料' }), {
      action: 'continue_brief',
    });
    assert.deepEqual(
      decideJibaUnboxMessage({ ...brief, text: '我了解用途，開始填資料' }),
      { action: 'continue_brief' },
    );
    assert.deepEqual(
      decideJibaUnboxMessage({ ...brief, text: '好，開始填收件資訊' }),
      { action: 'continue_brief' },
    );
    assert.deepEqual(decideJibaUnboxMessage({ ...brief, text: '想加購' }), {
      action: 'continue_brief',
    });
  });

  it('full order: invite → join → product → brief → shipping → upsell → license', () => {
    const expected = [
      FLOW_STATE.CAMPAIGN_INTRO,
      FLOW_STATE.ASK_PRODUCT,
      FLOW_STATE.SHOW_BRIEF,
      FLOW_STATE.ASK_RECIPIENT_NAME,
      FLOW_STATE.ASK_RECIPIENT_PHONE,
      FLOW_STATE.ASK_STORE,
      FLOW_STATE.CONFIRM_STORE,
      FLOW_STATE.ASK_UPSELL,
      FLOW_STATE.ASK_INSTAGRAM,
      FLOW_STATE.ASK_PET_NAME,
      FLOW_STATE.ASK_CONTENT_LICENSE,
      FLOW_STATE.SHOW_ORDER_CONFIRMATION,
      FLOW_STATE.PENDING_REVIEW,
    ];
    assert.deepEqual([...JIBA_COLLECTING_SEQUENCE], expected);
    const upsellAt = expected.indexOf(FLOW_STATE.ASK_UPSELL);
    const nameAt = expected.indexOf(FLOW_STATE.ASK_RECIPIENT_NAME);
    const storeAt = expected.indexOf(FLOW_STATE.CONFIRM_STORE);
    assert.ok(nameAt < storeAt);
    assert.ok(storeAt < upsellAt);
  });

  for (const productKey of ['jiba', 'frog', 'catnip'] as const) {
    it(`${productKey} path never asks upsell before shipping is complete`, () => {
      const askProduct = {
        sessionActive: true,
        pausedForRegister: false,
        hasApplication: true,
        state: FLOW_STATE.ASK_PRODUCT,
      };
      const picked = decideJibaUnboxMessage({
        ...askProduct,
        text: productKey === 'jiba' ? '選雞霸' : productKey === 'frog' ? '選青蛙' : '選貓草雞肉乾',
      });
      assert.deepEqual(picked, { action: 'pick_product', productKey });

      const brief = jibaProductBrief(productKey);
      assert.doesNotMatch(brief, /399|886|加購/);
      if (productKey === 'catnip') {
        assert.match(brief, /catnip-chick/);
      } else {
        assert.doesNotMatch(brief, /catnip-chick/);
      }

      assert.deepEqual(
        decideJibaUnboxMessage({
          sessionActive: true,
          pausedForRegister: false,
          hasApplication: true,
          state: FLOW_STATE.SHOW_BRIEF,
          text: '想加購',
        }),
        { action: 'continue_brief' },
      );

      assert.notEqual(
        decideJibaUnboxMessage({
          sessionActive: true,
          pausedForRegister: false,
          hasApplication: true,
          state: FLOW_STATE.ASK_RECIPIENT_NAME,
          text: '想加購',
        }).action,
        'accept_upsell',
      );

      assert.deepEqual(
        decideJibaUnboxMessage({
          sessionActive: true,
          pausedForRegister: false,
          hasApplication: true,
          state: FLOW_STATE.ASK_UPSELL,
          text: '想加購',
        }),
        { action: 'accept_upsell' },
      );
      assert.deepEqual(
        decideJibaUnboxMessage({
          sessionActive: true,
          pausedForRegister: false,
          hasApplication: true,
          state: FLOW_STATE.ASK_UPSELL,
          text: '這次先不加',
        }),
        { action: 'skip_upsell' },
      );
    });
  }

  it('先不用 ends invite without joining', () => {
    const intro = {
      sessionActive: true,
      pausedForRegister: false,
      hasApplication: false,
      state: FLOW_STATE.CAMPAIGN_INTRO,
    };
    assert.deepEqual(decideJibaUnboxMessage({ ...intro, text: '先不用' }), {
      action: 'decline',
    });
  });

  it('先不用 at product pick cancels half enrollment', () => {
    assert.deepEqual(
      decideJibaUnboxMessage({
        text: '先不用',
        sessionActive: true,
        pausedForRegister: false,
        hasApplication: true,
        state: FLOW_STATE.ASK_PRODUCT,
      }),
      { action: 'decline' },
    );
  });

  it('resending keyword during any step replays that step', () => {
    const states = [
      FLOW_STATE.CAMPAIGN_INTRO,
      FLOW_STATE.ASK_PRODUCT,
      FLOW_STATE.SHOW_BRIEF,
      FLOW_STATE.ASK_RECIPIENT_NAME,
      FLOW_STATE.ASK_RECIPIENT_PHONE,
      FLOW_STATE.ASK_STORE,
      FLOW_STATE.ASK_UPSELL,
      FLOW_STATE.ASK_INSTAGRAM,
    ] as const;
    for (const state of states) {
      const decision = decideJibaUnboxMessage({
        text: '開箱任務',
        sessionActive: true,
        pausedForRegister: false,
        hasApplication: state !== FLOW_STATE.CAMPAIGN_INTRO,
        state,
      });
      assert.deepEqual(decision, { action: 'replay', state }, `replay ${state}`);
    }
  });

  it('three product paths stay distinct', () => {
    const askProduct = {
      sessionActive: true,
      pausedForRegister: false,
      hasApplication: true,
      state: FLOW_STATE.ASK_PRODUCT,
    };
    assert.equal(
      decideJibaUnboxMessage({ ...askProduct, text: '選雞霸' }).action === 'pick_product' &&
        decideJibaUnboxMessage({ ...askProduct, text: '選雞霸' }).action === 'pick_product'
        ? (decideJibaUnboxMessage({ ...askProduct, text: '選雞霸' }) as { productKey: string })
            .productKey
        : null,
      'jiba',
    );
    assert.equal(
      (decideJibaUnboxMessage({ ...askProduct, text: '選青蛙' }) as { productKey?: string })
        .productKey,
      'frog',
    );
    assert.equal(
      (decideJibaUnboxMessage({ ...askProduct, text: '選貓草雞肉乾' }) as { productKey?: string })
        .productKey,
      'catnip',
    );
    assert.deepEqual(decideJibaUnboxMessage({ ...askProduct, text: '我要參加' }), {
      action: 'reprompt_product',
    });
  });

  it('先不用 at ASK_UPSELL skips add-on, does not decline the application', () => {
    assert.deepEqual(
      decideJibaUnboxMessage({
        text: '先不用',
        sessionActive: true,
        pausedForRegister: false,
        hasApplication: true,
        state: FLOW_STATE.ASK_UPSELL,
      }),
      { action: 'skip_upsell' },
    );
  });

  it('random invite chatter reprompts invite, not product', () => {
    assert.deepEqual(
      decideJibaUnboxMessage({
        text: '好想參加但再看看',
        sessionActive: true,
        pausedForRegister: false,
        hasApplication: false,
        state: FLOW_STATE.CAMPAIGN_INTRO,
      }),
      { action: 'reprompt_invite' },
    );
  });
});
