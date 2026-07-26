import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GROOMING_SOON_LINES, buildJarHubItems } from '../brand-worlds';
import { buildMainMenuMessages } from '../flex-menu';
import {
  buildWorldHubMessages,
  buildRegisterGateMessages,
  buildJarExplainMessages,
  buildButtonMenuFlex,
  buildHomeHubMessages,
  buildGroomingSoonMessages,
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
  const footer = flex.contents.footer?.contents ?? [];
  return footer.filter((x) => (x as { type?: string }).type === 'button').length;
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
          mark: '🐾',
          action: { type: 'postback', data: 'jd=jar_reg' },
          style: 'primary',
        },
      ],
    });
    assert.equal(flex.contents.type, 'bubble');
    assert.match(JSON.stringify(flex), /"type":"button"/);
    assert.doesNotMatch(JSON.stringify(flex), /carousel/);
  });
});

describe('換罐計劃六卡', () => {
  it('未開戶：開戶為主，六項齊全', () => {
    const hub = buildJarHubItems(false);
    const ids = hub.items.map((i) => i.id);
    assert.deepEqual(ids, [
      'jar_reg',
      'jar_vault',
      'jar_enter',
      'jar_history',
      'jar_stores',
      'jar_explain',
    ]);
    assert.equal(hub.primaryId, 'jar_reg');
    assert.match(hub.items.find((i) => i.id === 'jar_reg')!.label, /開戶/);
    assert.match(hub.items.find((i) => i.id === 'jar_vault')!.label, /我的會員/);
    assert.match(hub.items.find((i) => i.id === 'jar_stores')!.label, /合作美容店/);
    assert.match(hub.items.find((i) => i.id === 'jar_explain')!.label, /換罐說明/);
  });

  it('已開戶：輸入序號為主，同樣六項', () => {
    const hub = buildJarHubItems(true);
    const ids = hub.items.map((i) => i.id);
    assert.equal(ids.length, 6);
    assert.equal(hub.primaryId, 'jar_enter');
  });

  it('Flex 是垂直按鈕選單', () => {
    const guest = buildWorldHubMessages('jar', { registered: false });
    const flex = flexFrom(guest);
    assert.equal(flex.contents.type, 'bubble');
    assert.equal(countButtons(flex), 6);
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /開戶/);
    assert.match(raw, /輸入序號/);
    assert.match(raw, /"type":"button"/);
    assert.doesNotMatch(raw, /carousel/);
  });
});

describe('一起野放', () => {
  it('社區／UGC／活動為垂直按鈕', () => {
    const flex = flexFrom(buildWorldHubMessages('chaos'));
    assert.equal(flex.contents.type, 'bubble');
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /嗷嗚計劃/);
    assert.match(raw, /青蛙誰在怕/);
    assert.match(raw, /活動/);
    assert.match(raw, /開箱任務/);
    assert.match(raw, /"type":"button"/);
    assert.doesNotMatch(raw, /限定合作|優惠企劃|carousel/);
    assert.doesNotMatch(raw, /拍攝指南|完成拿100/);
  });

  it('漫畫入口文案帶傑克與按鈕提示', () => {
    const msgs = buildComicRoamMessages(false);
    const text = msgs.find((m) => m.type === 'text') as { text: string };
    assert.match(text.text, /傑克|外面/);
    assert.match(text.text, /按鈕/);
  });
});

describe('回家', () => {
  it('只有官網與 IG', () => {
    const raw = JSON.stringify(flexFrom(buildHomeHubMessages()));
    assert.match(raw, /furmosa\.com|回家/);
    assert.match(raw, /Instagram|furmosa_food/);
    assert.doesNotMatch(raw, /Threads|Facebook|合作店家|品牌故事|carousel/);
  });

  it('漫畫回家入口', () => {
    const msgs = buildComicHomeMessages(false);
    assert.ok(flexFrom(msgs));
  });
});

describe('預約美容 coming soon', () => {
  it('好玩文案，不是建設中', () => {
    const msgs = buildGroomingSoonMessages(GROOMING_SOON_LINES[0]!);
    const raw = JSON.stringify(msgs);
    assert.match(raw, /洗澡水還沒放滿|預約美容/);
    assert.doesNotMatch(raw, /建設中|敬請期待|carousel/);
    assert.ok(flexFrom(msgs));
  });

  it('漫畫入口回 playful placeholder', () => {
    const msgs = buildComicGroomingMessages();
    const raw = JSON.stringify(msgs);
    assert.doesNotMatch(raw, /建設中/);
    assert.match(raw, /預約美容/);
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
  it('四個說明按鈕', () => {
    const flex = flexFrom(buildJarExplainMessages());
    assert.equal(countButtons(flex), 4);
    const raw = JSON.stringify(flex);
    assert.match(raw, /介紹/);
    assert.match(raw, /流程/);
    assert.match(raw, /合作店家|合作美容/);
    assert.match(raw, /常見問題/);
    assert.doesNotMatch(raw, /carousel/);
  });
});
