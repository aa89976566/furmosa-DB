import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildJarHubItems, buildJarMoreHelpItems } from '../brand-worlds';
import { buildMainMenuMessages } from '../flex-menu';
import {
  buildWorldHubMessages,
  buildRegisterGateMessages,
  buildJarExplainMessages,
  buildButtonMenuFlex,
  buildHomeHubMessages,
  buildGroomingSoonMessages,
  buildFrogProjectMessages,
  buildEventsCenterMessages,
  buildJarExplainTopicMessages,
  buildJarStartMessages,
  buildConversationRecoveryMessages,
  buildRefillLaunchMessages,
  buildJarMoreHelpMessages,
  REFILL_LIFF_UNAVAILABLE,
  GROOMING_SOON_COPY,
} from '../flex-hubs';
import { WORLD_THEME } from '../card-theme';
import {
  buildComicGroomingMessages,
  buildComicHomeMessages,
  buildComicRoamMessages,
} from '../comic-menu';

function flexFrom(msgs: { type: string }[]) {
  return msgs.find((m) => m.type === 'flex') as {
    type: 'flex';
    contents: {
      type?: string;
      contents?: unknown[];
      footer?: { contents?: unknown[] };
      body?: { contents?: unknown[] };
    };
  };
}

function countButtons(flex: ReturnType<typeof flexFrom>): number {
  let n = 0;
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    const o = node as { type?: string; contents?: unknown };
    if (o.type === 'button') n += 1;
    if (o.contents) walk(o.contents);
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object' && v !== o.contents) walk(v);
    }
  };
  walk(flex.contents);
  return n;
}

describe('buildMainMenuMessages', () => {
  it('備援選單是垂直按鈕，不是 carousel', () => {
    const msgs = buildMainMenuMessages({ body: '測試內文', registered: false });
    const flex = flexFrom(msgs);
    assert.ok(flex);
    assert.equal(flex.contents.type, 'bubble');
    assert.equal(countButtons(flex), 3);
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /換罐計劃/);
    assert.match(raw, /一起野放/);
    assert.match(raw, /回家/);
    assert.match(raw, /"type":"button"/);
    assert.doesNotMatch(raw, /carousel/);
    assert.doesNotMatch(raw, /訂閱爆罐|領福利|產品導購|粉絲專頁/);
  });
});

describe('垂直按鈕選單', () => {
  it('buildButtonMenuFlex 產出 button 元件', () => {
    const flex = buildButtonMenuFlex({
      altText: '測試',
      theme: WORLD_THEME.jar,
      title: '換罐計劃',
      items: [
        {
          label: '開戶',
          action: { type: 'postback', data: 'jd=jar_reg' },
          style: 'primary',
        },
      ],
    });
    const bubble = flex as { contents: { type?: string } };
    assert.equal(bubble.contents.type, 'bubble');
    assert.match(JSON.stringify(flex), /"type":"button"/);
    assert.doesNotMatch(JSON.stringify(flex), /carousel/);
  });
});

describe('換罐計劃選單', () => {
  const primaryIds = ['jar_refill', 'jar_reg', 'jar_enter', 'jar_more'];

  it('一級三主鍵＋了解更多；我要換罐 highlight；不直接掛 LIFF URI', () => {
    const hub = buildJarHubItems(false);
    const ids = hub.items.map((i) => i.id);
    assert.deepEqual(ids, primaryIds);
    assert.equal(hub.primaryId, 'jar_refill');
    assert.deepEqual(
      hub.items.map((i) => i.label),
      ['我要換罐', '幫毛孩開戶', '輸入空罐序號', '了解更多'],
    );
    assert.equal(hub.items.find((i) => i.id === 'jar_refill')!.message, '我要換罐');
    assert.equal(hub.items.find((i) => i.id === 'jar_refill')!.uri, undefined);
    assert.ok(!ids.includes('jar_refill_pay'));
    assert.ok(!ids.includes('jar_explain_intro'));
  });

  it('已開戶與未開戶同一級選單形狀', () => {
    const hub = buildJarHubItems(true);
    assert.deepEqual(
      hub.items.map((i) => i.id),
      primaryIds,
    );
    assert.equal(hub.primaryId, 'jar_refill');
  });

  it('了解更多二級保留說明／點數／店家／FAQ', () => {
    const items = buildJarMoreHelpItems();
    assert.deepEqual(
      items.map((i) => i.id),
      ['jar_explain_intro', 'redeem_coupon', 'jar_stores', 'jar_faq'],
    );
    const msgs = buildJarMoreHelpMessages();
    const raw = JSON.stringify(msgs);
    assert.match(raw, /什麼是換罐計劃？/);
    assert.match(raw, /點數換折價/);
    assert.match(raw, /查看合作店家/);
    assert.match(raw, /毛爸媽常問/);
  });

  it('只回選單卡；我要換罐為 primary，且無直連 liff.line.me', () => {
    const guest = buildWorldHubMessages('jar', { registered: false });
    assert.equal(guest.length, 1);
    assert.equal(guest[0]?.type, 'flex');
    const flex = flexFrom(guest);
    assert.equal(flex.contents.type, 'bubble');
    const raw = JSON.stringify(flex.contents);
    assert.equal(countButtons(flex), 4);
    assert.match(raw, /我要換罐/);
    assert.match(raw, /幫毛孩開戶/);
    assert.match(raw, /輸入空罐序號/);
    assert.match(raw, /了解更多/);
    assert.match(raw, /空罐先別丟/);
    assert.match(raw, /dialogue-bg-nose-v3\.jpg/);
    assert.match(raw, /"style":"primary"/);
    assert.doesNotMatch(raw, /liff\.line\.me/);
    assert.doesNotMatch(raw, /線上預購換罐/);
    assert.doesNotMatch(raw, /點下面按鈕/);
    assert.match(raw, /"type":"message"/);
    assert.doesNotMatch(raw, /carousel/);

    const member = buildWorldHubMessages('jar', { registered: true });
    assert.equal(countButtons(flexFrom(member)), 4);
  });
});

describe('換罐閘道 CTA／恢復卡', () => {
  it('已確認開戶後才給開始換罐 URI；未設定則友善說明', () => {
    const prev = process.env.LINE_LIFF_ID_REFILL;
    try {
      delete process.env.LINE_LIFF_ID_REFILL;
      delete process.env.LINE_LIFF_ID;
      const unavailable = buildRefillLaunchMessages();
      const rawOff = JSON.stringify(unavailable);
      assert.doesNotMatch(rawOff, /liff\.line\.me/);
      assert.match(rawOff, new RegExp(REFILL_LIFF_UNAVAILABLE.slice(0, 8)));

      process.env.LINE_LIFF_ID_REFILL = '2009953429-testRefill';
      const ready = buildRefillLaunchMessages();
      const rawOn = JSON.stringify(ready);
      assert.match(rawOn, /開始換罐/);
      assert.match(rawOn, /liff\.line\.me\/2009953429-testRefill/);
      assert.equal(ready.filter((m) => m.type === 'flex').length, 1);
    } finally {
      if (prev === undefined) delete process.env.LINE_LIFF_ID_REFILL;
      else process.env.LINE_LIFF_ID_REFILL = prev;
    }
  });

  it('恢復卡四鍵：開戶／換罐／空罐序號／查看點數', () => {
    const msgs = buildConversationRecoveryMessages('這句我們沒接住～');
    const raw = JSON.stringify(msgs);
    assert.match(raw, /幫毛孩開戶/);
    assert.match(raw, /我要換罐/);
    assert.match(raw, /輸入空罐序號/);
    assert.match(raw, /查看點數/);
    assert.equal(countButtons(flexFrom(msgs)), 4);
  });
});

describe('一起野放', () => {
  it('三鍵：嗷嗚計劃／活動中心／開箱任務（message 按鈕）', () => {
    const flex = flexFrom(buildWorldHubMessages('chaos'));
    assert.equal(flex.contents.type, 'bubble');
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /嗷嗚計劃/);
    assert.match(raw, /活動中心/);
    assert.match(raw, /開箱任務/);
    assert.match(raw, /探索新鮮事/);
    assert.match(raw, /"type":"button"/);
    assert.match(raw, /"type":"message"/);
    assert.equal(countButtons(flex), 3);
    assert.doesNotMatch(raw, /"label":"青蛙誰在怕"/);
    assert.doesNotMatch(raw, /"label":"活動"/);
    assert.doesNotMatch(raw, /限定合作|優惠企劃|carousel/);
    assert.doesNotMatch(raw, /拍攝指南|完成拿100/);
  });

  it('漫畫入口只回選單卡，不發開場長文', () => {
    const msgs = buildComicRoamMessages(false);
    assert.equal(msgs.some((m) => m.type === 'text'), false);
    const flex = flexFrom(msgs);
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /探索新鮮事/);
    assert.doesNotMatch(JSON.stringify(msgs), /傑克/);
  });

  it('嗷嗚計劃：輪播 cover＋對話氣泡（無傑克）', () => {
    const msgs = buildFrogProjectMessages({ registered: false, includeHub: false });
    assert.equal(msgs[0]?.type, 'image');
    const img = msgs[0] as { originalContentUrl: string };
    assert.match(img.originalContentUrl, /chaos-frog\.png/);
    const texts = msgs.filter((m) => m.type === 'text') as { text: string }[];
    assert.ok(texts.length >= 2);
    const joined = texts.map((t) => t.text).join('\n');
    assert.match(joined, /青蛙誰在怕/);
    assert.match(joined, /青蛙凍乾/);
    assert.doesNotMatch(joined, /傑克|【/);
    assert.ok(msgs.length <= 5);
  });

  it('活動中心：輪播 cover＋邀請丟想法（bark）', () => {
    const msgs = buildEventsCenterMessages({ registered: false, includeHub: false });
    assert.equal(msgs[0]?.type, 'image');
    const img = msgs[0] as { originalContentUrl: string };
    assert.match(img.originalContentUrl, /chaos-events\.png|poster\.jpg/);
    const texts = msgs.filter((m) => m.type === 'text') as { text: string }[];
    assert.ok(texts.length >= 1);
    const joined = texts.map((t) => t.text).join('\n');
    assert.match(joined, /汪！活動中心報到/);
    assert.match(joined, /丟想法/);
    assert.match(joined, /你提的點子/);
    assert.match(joined, /下一檔活動/);
    assert.doesNotMatch(joined, /沒梗了/);
    assert.doesNotMatch(joined, /你家那句/);
    assert.doesNotMatch(joined, /【/);
    assert.ok(msgs.length <= 5);
  });
});

describe('回家', () => {
  it('文案與按鈕為狗屋／院子', () => {
    const msgs = buildHomeHubMessages();
    const text = msgs.find((m) => m.type === 'text') as { text: string };
    assert.match(text.text, /歡迎回家/);
    assert.match(text.text, /狗屋/);
    assert.match(text.text, /院子/);
    const raw = JSON.stringify(flexFrom(msgs));
    assert.match(raw, /進狗屋（官網）/);
    assert.match(raw, /去院子（Instagram）/);
    assert.match(raw, /"type":"button"/);
    assert.doesNotMatch(raw, /Threads|Facebook|合作店家|品牌故事|carousel/);
    assert.doesNotMatch(raw, /開飯去|去厝邊/);
  });

  it('漫畫回家入口', () => {
    const msgs = buildComicHomeMessages(false);
    assert.ok(flexFrom(msgs));
  });
});

describe('預約美容 coming soon', () => {
  it('封面圖＋吹毛文案，不是建設中', () => {
    const msgs = buildGroomingSoonMessages();
    const img = msgs.find((m) => m.type === 'image') as {
      type: 'image';
      originalContentUrl: string;
    };
    const text = msgs.find((m) => m.type === 'text') as { type: 'text'; text: string };
    assert.ok(img?.originalContentUrl.includes('/line/grooming/soon-cover.jpg'));
    assert.equal(text.text, GROOMING_SOON_COPY);
    assert.match(text.text, /吹毛/);
    assert.doesNotMatch(JSON.stringify(msgs), /建設中|敬請期待|carousel|先去換罐/);
  });

  it('漫畫入口回封面＋文案', () => {
    const msgs = buildComicGroomingMessages();
    const raw = JSON.stringify(msgs);
    assert.doesNotMatch(raw, /建設中/);
    assert.match(raw, /吹毛|soon-cover/);
  });
});

describe('未開戶擋序號', () => {
  it('垂直按鈕＋立刻開戶', () => {
    const msgs = buildRegisterGateMessages();
    const flex = flexFrom(msgs);
    const raw = JSON.stringify(flex);
    assert.match(raw, /立刻開戶|先幫毛孩開戶|開戶/);
    assert.match(raw, /next=enter/);
    assert.equal(flex.contents.type, 'bubble');
    assert.ok(countButtons(flex) >= 1);
    assert.doesNotMatch(raw, /carousel/);
  });
});

describe('換罐說明', () => {
  it('三個說明按鈕（店家改在主選單，不重複）', () => {
    const msgs = buildJarExplainMessages();
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]?.type, 'flex');
    const flex = flexFrom(msgs);
    assert.equal(countButtons(flex), 3);
    const raw = JSON.stringify(flex);
    assert.match(raw, /什麼是換罐計劃？/);
    assert.match(raw, /流程/);
    assert.match(raw, /毛爸媽常問/);
    assert.match(raw, /想先看哪一段/);
    assert.doesNotMatch(raw, /合作店家|配合店家/);
    assert.doesNotMatch(raw, /點下面按鈕/);
    assert.doesNotMatch(raw, /carousel/);
    assert.doesNotMatch(JSON.stringify(msgs), /換罐怎麼玩/);
  });

  it('點介紹：主視覺＋制度 Flex（不再三則泡泡）', async () => {
    const msgs = await buildJarExplainTopicMessages('intro');
    assert.equal(msgs[0]?.type, 'image');
    const img = msgs[0] as { originalContentUrl: string };
    assert.match(img.originalContentUrl, /refill-flavours-v2\.jpg/);
    assert.equal(msgs.length, 2);
    assert.equal(msgs[1]?.type, 'flex');
    const raw = JSON.stringify(msgs[1]);
    assert.match(raw, /dialogue-bg-nose-v3\.jpg/);
    assert.match(raw, /"position":"absolute"/);
    assert.match(raw, /吃完，不用說再見/);
    assert.match(raw, /NT\$129/);
    assert.match(raw, /NT\$99/);
    assert.match(raw, /開始換罐/);
    assert.match(raw, /"text":"開始換罐"/);
    assert.doesNotMatch(raw, /"text":"立即開戶"/);
    assert.doesNotMatch(raw, /"text":"兌換序號"/);
    assert.match(raw, /看本期口味/);
    assert.doesNotMatch(raw, /零食罐吃完先別丟/);
    assert.doesNotMatch(JSON.stringify(msgs), /罐底那串 8 碼傳上來/);
  });

  it('開始換罐：已開戶回下一步卡，換罐走文字閘道不直連 URI', () => {
    const msgs = buildJarStartMessages({
      registered: true,
      customerName: '豆豆',
      refillLiffUrl: 'https://liff.line.me/example',
    });
    assert.equal(msgs.length, 1);
    const raw = JSON.stringify(msgs);
    assert.match(raw, /開始換罐/);
    assert.match(raw, /豆豆 已開戶/);
    assert.match(raw, /輸入空罐序號/);
    assert.match(raw, /我要換罐/);
    assert.match(raw, /我的會員/);
    assert.doesNotMatch(raw, /liff\.line\.me/);
    assert.doesNotMatch(raw, /幫毛孩開戶/);
    assert.doesNotMatch(raw, /立即開戶/);
  });

  it('開始換罐：未開戶只引導開戶，不假裝已可輸入序號', () => {
    const msgs = buildJarStartMessages({ registered: false });
    const raw = JSON.stringify(msgs);
    assert.match(raw, /開始換罐/);
    assert.match(raw, /幫毛孩開戶/);
    assert.match(raw, /jar_reg&next=enter/);
    assert.doesNotMatch(raw, /輸入空罐序號/);
    assert.doesNotMatch(raw, /已開戶/);
  });

  it('點流程：無圖八幕故事卡', async () => {
    const msgs = await buildJarExplainTopicMessages('flow');
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]?.type, 'flex');
    const raw = JSON.stringify(msgs);
    assert.ok(msgs.every((m) => m.type !== 'image'));
    assert.match(raw, /dialogue-bg-nose-v3\.jpg/);
    assert.match(raw, /"position":"absolute"/);
    assert.match(raw, /換罐循環故事/);
    assert.match(raw, /第一次買一罐/);
    assert.match(raw, /NT\$129/);
    assert.match(raw, /NT\$99/);
    assert.match(raw, /瓶底 8 碼|8 碼/);
    assert.match(raw, /集滿 10 點/);
    assert.match(raw, /NT\$200/);
    assert.match(raw, /一直循環/);
    assert.doesNotMatch(raw, /玩法很簡單/);
  });

  it('點 FAQ：單一 Flex 含正式規則', async () => {
    const msgs = await buildJarExplainTopicMessages('faq');
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]?.type, 'flex');
    const raw = JSON.stringify(msgs[0]);
    assert.match(raw, /dialogue-bg-nose-v3\.jpg/);
    assert.match(raw, /第一罐多少錢/);
    assert.match(raw, /NT\$129/);
    assert.match(raw, /NT\$99/);
    assert.match(raw, /空罐/);
  });
});
