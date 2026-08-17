import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FLOW_STATE } from '../../campaigns/jiba-two-piece/constants';
import {
  JIBA_INVITE_BODY,
  JIBA_INVITE_DECLINE,
  JIBA_INVITE_JOIN,
  JIBA_INVITE_TITLE,
} from '../../campaigns/jiba-two-piece/copy';
import { validRecipientName } from '../../campaigns/jiba-two-piece/validation';
import { jibaInviteMenu, jibaProductChoiceMenu } from '../campaigns/jiba-unbox/menus';
import {
  decideJibaUnboxEntry,
  decideJibaUnboxMessage,
} from '../campaigns/jiba-unbox/turns';
import type { LineReplyMessage } from '../reply';

function flexRaw(msg: LineReplyMessage) {
  if (msg.type === 'flex') return JSON.stringify(msg.contents);
  return JSON.stringify(msg);
}

describe('jiba invite / product menus', () => {
  it('invite is a single decision without product or extra topics', () => {
    const menu = jibaInviteMenu();
    const raw = flexRaw(menu);
    assert.match(raw, new RegExp(JIBA_INVITE_TITLE));
    assert.match(raw, new RegExp(JIBA_INVITE_BODY.slice(0, 8)));
    assert.match(raw, new RegExp(JIBA_INVITE_JOIN));
    assert.match(raw, new RegExp(JIBA_INVITE_DECLINE));
    assert.doesNotMatch(raw, /先看看規則|收件|授權|399|886|catnip-chick|選雞霸|選青蛙/);
    assert.equal((raw.match(/"type":"button"/g) ?? []).length, 2);
  });

  it('product menu has three LINE buttons with safe payloads', () => {
    const menu = jibaProductChoiceMenu();
    const raw = flexRaw(menu);
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
  });

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
