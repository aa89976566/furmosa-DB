import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildJarHubItems } from '../brand-worlds';
import { buildMainMenuMessages, buildStorePickerMessages } from '../flex-menu';
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


describe('開戶合作店按鈕', () => {
  it('使用純 postback，不附 displayText，避免點一次再產生第二個文字事件', async () => {
    const msgs = await buildStorePickerMessages();
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]?.type, 'flex');
    const raw = JSON.stringify(msgs[0]);
    assert.match(raw, /"type":"postback"/);
    assert.match(raw, /jd=store&c=/);
    assert.doesNotMatch(raw, /"displayText"/);
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
    if (flex.type !== 'flex') assert.fail('expected a flex message');
    assert.equal(flex.contents.type, 'bubble');
    assert.match(JSON.stringify(flex), /"type":"button"/);
    assert.doesNotMatch(JSON.stringify(flex), /carousel/);
  });
});

describe('換罐計劃選單', () => {
  const baseIds = [
    'jar_explain_intro',
    'jar_reg',
    'jar_enter',
    'jar_member',
    'redeem_coupon',
    'jar_faq',
  ];

  it('未開戶：固定六鍵，換罐介紹 highlight', () => {
    const hub = buildJarHubItems(false);
    const ids = hub.items.map((i) => i.id);
    assert.deepEqual(ids, baseIds);
    assert.equal(hub.primaryId, 'jar_explain_intro');
    assert.deepEqual(
      hub.items.map((i) => i.label),
      ['什麼是換罐計劃？', '幫毛孩開戶', '輸入序號', '我的會員與紀錄', '點數換折價', '毛爸媽常問'],
    );
    assert.ok(!ids.includes('jar_explain'));
    assert.ok(!ids.includes('jar_stores'));
  });

  it('已開戶：同樣六鍵與語境文案', () => {
    const hub = buildJarHubItems(true);
    const ids = hub.items.map((i) => i.id);
    assert.deepEqual(ids, baseIds);
    assert.equal(hub.primaryId, 'jar_explain_intro');
    assert.equal(hub.items.find((i) => i.id === 'jar_reg')!.label, '幫毛孩開戶');
    assert.equal(hub.items.find((i) => i.id === 'jar_member')!.label, '我的會員與紀錄');
    assert.equal(hub.items.find((i) => i.id === 'redeem_coupon')!.label, '點數換折價');
    assert.equal(hub.items.find((i) => i.id === 'jar_faq')!.label, '毛爸媽常問');
  });

  it('有 LIFF URL 時第三鍵為線上預購換罐', () => {
    const hub = buildJarHubItems(true, {
      refillLiffUrl: 'https://liff.line.me/2009953429-1hqRSGV8',
    });
    assert.equal(hub.items[2]?.id, 'jar_refill_pay');
    assert.equal(hub.items[2]?.label, '線上預購換罐');
    assert.equal(hub.items[2]?.uri, 'https://liff.line.me/2009953429-1hqRSGV8');
    assert.equal(hub.primaryId, 'jar_explain_intro');
    assert.deepEqual(
      hub.items.map((i) => i.id),
      [
        'jar_explain_intro',
        'jar_reg',
        'jar_refill_pay',
        'jar_enter',
        'jar_member',
        'redeem_coupon',
        'jar_faq',
      ],
    );
  });

  it('有註冊 LIFF URL 時，幫毛孩開戶直接打開新版視窗', () => {
    const hub = buildJarHubItems(false, {
      registerLiffUrl: 'https://liff.line.me/2009953429-register',
    });
    const register = hub.items.find((item) => item.id === 'jar_reg');
    assert.equal(register?.uri, 'https://liff.line.me/2009953429-register');
    assert.equal(register?.message, undefined);
  });

  it('只回選單卡；換罐介紹為 primary highlight', () => {
    const guest = buildWorldHubMessages('jar', { registered: false });
    assert.equal(guest.length, 1);
    assert.equal(guest[0]?.type, 'flex');
    const flex = flexFrom(guest);
    assert.equal(flex.contents.type, 'bubble');
    // 測試環境通常未設 LINE_LIFF_ID_REFILL → 六鍵；有設則七鍵含「線上預購換罐」
    const raw = JSON.stringify(flex.contents);
    const hasRefillEnv = Boolean(process.env.LINE_LIFF_ID_REFILL?.trim());
    assert.equal(countButtons(flex), 0);
    assert.match(raw, /什麼是換罐計劃？/);
    assert.match(raw, /幫毛孩開戶/);
    assert.match(raw, /毛爸媽常問/);
    assert.match(raw, /我的會員與紀錄/);
    assert.match(raw, /點數換折價/);
    assert.match(raw, /輸入序號/);
    assert.match(raw, /空罐先別丟/);
    assert.match(raw, /換罐計畫/);
    assert.match(raw, /從這裡開始/);
    assert.match(raw, /#2F6FBB/);
    assert.match(raw, /#FFD348/);
    assert.match(raw, /#FFFAF0/);
    assert.doesNotMatch(raw, /dialogue-bg-nose-v3\.jpg/);
    assert.doesNotMatch(raw, /#1F5C45/);
    assert.doesNotMatch(raw, /這計劃到底幹嘛/);
    assert.doesNotMatch(raw, /先別急著問客服/);
    assert.doesNotMatch(raw, /吃完別丟/);
    assert.match(raw, /"backgroundColor":"#2F6FBB"/);
    if (hasRefillEnv) {
      assert.match(raw, /線上預購換罐/);
      assert.match(raw, /liff\.line\.me/);
    }
    assert.doesNotMatch(raw, /點下面按鈕/);
    assert.doesNotMatch(raw, /"type":"button"/);
    assert.match(raw, /"type":"message"/);
    assert.doesNotMatch(raw, /carousel/);

    const member = buildWorldHubMessages('jar', { registered: true });
    assert.equal(member.length, 1);
    const memberFlex = flexFrom(member);
    assert.equal(countButtons(memberFlex), 0);
    const memberRaw = JSON.stringify(memberFlex.contents);
    assert.match(memberRaw, /輸入序號/);
    assert.match(memberRaw, /點數換折價/);
    assert.match(memberRaw, /幫毛孩開戶/);
    assert.match(memberRaw, /我的會員與紀錄/);
    assert.match(memberRaw, /"type":"message"/);
    assert.match(memberRaw, /"backgroundColor":"#2F6FBB"/);
    assert.doesNotMatch(memberRaw, /點數換好康/);
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
    if (process.env.LINE_LIFF_ID_REGISTER?.trim()) {
      assert.match(raw, /https:\/\/liff\.line\.me\//);
      assert.doesNotMatch(raw, /next=enter/);
    } else {
      assert.match(raw, /next=enter/);
    }
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

  it('點介紹：單一 Flex 顯示真實產品照、三款換罐內容與集點規則', async () => {
    const msgs = await buildJarExplainTopicMessages('intro');
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0]?.type, 'flex');
    const raw = JSON.stringify(msgs[0]);
    assert.match(raw, /棒棒牛/);
    assert.match(raw, /棒棒雞/);
    assert.match(raw, /脆脆鴨/);
    assert.match(raw, /5條／罐/);
    assert.match(raw, /27g／罐/);
    assert.match(raw, /到店換罐，每罐累積 1 點/);
    assert.match(raw, /集滿 10 點，兌換 NT\$200 店家折價券/);
    assert.match(raw, /首罐不計點/);
    assert.match(raw, /線上預購換罐/);
    assert.match(raw, /"text":"開始換罐"/);
    assert.match(raw, /"type":"image"/);
    assert.match(raw, /"hero"/);
    assert.match(raw, /https:\/\/hq\.furmosa\.com\/line\/refill\/intro-products\.jpg/);
    assert.doesNotMatch(raw, /dialogue-bg-nose-v3\.jpg/);
    assert.doesNotMatch(raw, /7 種|每兩週|菜菜雞/);
  });

  it('開始換罐：已開戶回下一步卡，不含開戶文案', () => {
    const msgs = buildJarStartMessages({
      registered: true,
      customerName: '豆豆',
      refillLiffUrl: 'https://liff.line.me/example',
    });
    assert.equal(msgs.length, 1);
    const raw = JSON.stringify(msgs);
    assert.match(raw, /開始換罐/);
    assert.match(raw, /帶完整空罐回合作店換購/);
    assert.match(raw, /"style":"primary"[^}]*"type":"message","label":"到店換罐｜查看合作店","text":"查看合作店"/);
    assert.match(raw, /"type":"uri","label":"線上預購換罐","uri":"https:\/\/liff\.line\.me\/example"/);
    assert.match(raw, /輸入序號/);
    assert.match(raw, /我的會員/);
    assert.doesNotMatch(raw, /幫毛孩開戶/);
    assert.doesNotMatch(raw, /立即開戶/);
    assert.doesNotMatch(raw, /先幫毛孩開好戶/);
  });

  it('開始換罐：未開戶只引導開戶，不假裝已可輸入序號', () => {
    const msgs = buildJarStartMessages({
      registered: false,
      registerLiffUrl: null,
    });
    const raw = JSON.stringify(msgs);
    assert.match(raw, /開始換罐/);
    assert.match(raw, /幫毛孩開戶/);
    assert.match(raw, /jar_reg&next=enter/);
    assert.match(raw, /"text":"查看合作店"/);
    assert.doesNotMatch(raw, /輸入序號/);
    assert.doesNotMatch(raw, /已開戶/);
  });

  it('開始換罐：正式註冊 LIFF 已設定時直接開啟新版視窗', () => {
    const msgs = buildJarStartMessages({
      registered: false,
      registerLiffUrl: 'https://liff.line.me/2009953429-register',
    });
    const raw = JSON.stringify(msgs);
    assert.match(raw, /https:\/\/liff\.line\.me\/2009953429-register/);
    assert.doesNotMatch(raw, /jar_reg&next=enter/);
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
    assert.match(raw, /線上預購第一罐/);
    assert.match(raw, /棒棒牛、棒棒雞、脆脆鴨/);
    assert.match(raw, /NT\$129/);
    assert.match(raw, /NT\$99/);
    assert.match(raw, /到店完成換罐/);
    assert.match(raw, /首罐不計點/);
    assert.match(raw, /滿 10 點/);
    assert.match(raw, /NT\$200/);
    assert.match(raw, /同一間店/);
    assert.doesNotMatch(raw, /毛孩去美容|美容店確認預約|每換一次就集 1 點/);
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
