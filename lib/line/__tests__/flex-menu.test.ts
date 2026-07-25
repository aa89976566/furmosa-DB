import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GROOMING_SOON_LINES, buildJarHubItems } from '../brand-worlds';
import { buildMainMenuMessages } from '../flex-menu';
import {
  buildWorldHubMessages,
  buildRegisterGateMessages,
  buildJarExplainMessages,
  buildActionCard,
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
    contents: { type?: string; contents?: unknown[] };
  };
}

describe('buildMainMenuMessages', () => {
  it('備援選單是世界大卡 carousel，不是六宮格按鈕', () => {
    const msgs = buildMainMenuMessages({ body: '測試內文', registered: false });
    const flex = flexFrom(msgs);
    assert.ok(flex);
    assert.equal(flex.contents.type, 'carousel');
    assert.equal(flex.contents.contents?.length, 3);
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /換罐計劃/);
    assert.match(raw, /一起野放/);
    assert.match(raw, /回家/);
    assert.doesNotMatch(raw, /訂閱爆罐|領福利|產品導購|粉絲專頁/);
    assert.doesNotMatch(raw, /"type":"button"/);
  });
});

describe('卡片式 ActionCard', () => {
  it('整卡 postback，沒有灰底 button 元件', () => {
    const card = buildActionCard({
      theme: WORLD_THEME.jar,
      mark: '🫙',
      title: '換罐計劃',
      subtitle: '瓶子才是主角。',
      heroKey: 'world-jar',
      action: { type: 'postback', data: 'jd=hub_jar' },
      ctaLabel: '開罐',
    });
    assert.equal(card.type, 'bubble');
    assert.ok(card.action);
    assert.ok(card.hero);
    assert.doesNotMatch(JSON.stringify(card), /"type":"button"/);
  });
});

describe('換罐計劃六卡', () => {
  it('未開戶：開戶為主，六卡齊全', () => {
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

  it('已開戶：輸入序號為主，同樣六卡', () => {
    const hub = buildJarHubItems(true);
    const ids = hub.items.map((i) => i.id);
    assert.equal(ids.length, 6);
    assert.equal(hub.primaryId, 'jar_enter');
  });

  it('Flex 是卡片 carousel', () => {
    const guest = buildWorldHubMessages('jar', { registered: false });
    const flex = flexFrom(guest);
    assert.equal(flex.contents.type, 'carousel');
    assert.equal(flex.contents.contents?.length, 6);
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /開戶/);
    assert.match(raw, /輸入序號/);
    assert.doesNotMatch(raw, /"type":"button"/);
  });
});

describe('一起野放', () => {
  it('社區／UGC／活動卡含青蛙封面', () => {
    const flex = flexFrom(buildWorldHubMessages('chaos'));
    assert.equal(flex.contents.type, 'carousel');
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /嗷嗚計劃/);
    assert.match(raw, /青蛙誰在怕/);
    assert.match(raw, /chaos-frog/);
    assert.match(raw, /活動/);
    assert.match(raw, /開箱任務/);
    assert.match(raw, /限定合作/);
    assert.match(raw, /優惠企劃/);
    assert.doesNotMatch(raw, /拍攝指南|完成拿100/);
  });

  it('漫畫入口文案帶傑克', () => {
    const msgs = buildComicRoamMessages(false);
    const text = msgs.find((m) => m.type === 'text') as { text: string };
    assert.match(text.text, /傑克|外面/);
  });
});

describe('回家', () => {
  it('只有官網與 IG', () => {
    const raw = JSON.stringify(flexFrom(buildHomeHubMessages()));
    assert.match(raw, /furmosa\.com|回家/);
    assert.match(raw, /Instagram|furmosa_food/);
    assert.doesNotMatch(raw, /Threads|Facebook|合作店家|品牌故事/);
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
    assert.doesNotMatch(raw, /建設中|敬請期待/);
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
  it('單一大卡＋立刻開戶', () => {
    const msgs = buildRegisterGateMessages();
    const flex = flexFrom(msgs);
    const raw = JSON.stringify(flex);
    assert.match(raw, /立刻開戶|先幫毛孩開戶|開戶/);
    assert.match(raw, /next=enter/);
    assert.equal(flex.contents.type, 'carousel');
    assert.equal(flex.contents.contents?.length, 1);
  });
});

describe('換罐說明', () => {
  it('四張說明卡', () => {
    const flex = flexFrom(buildJarExplainMessages());
    assert.equal(flex.contents.contents?.length, 4);
    const raw = JSON.stringify(flex);
    assert.match(raw, /介紹/);
    assert.match(raw, /流程/);
    assert.match(raw, /合作店家|合作美容/);
    assert.match(raw, /常見問題/);
  });
});
