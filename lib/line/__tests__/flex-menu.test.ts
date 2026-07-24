import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildJarHubItems } from '../brand-worlds';
import { buildMainMenuMessages } from '../flex-menu';
import {
  buildWorldHubMessages,
  buildRegisterGateMessages,
  buildJarExplainMessages,
  buildActionCard,
} from '../flex-hubs';
import { WORLD_THEME } from '../card-theme';

function flexFrom(msgs: { type: string }[]) {
  return msgs.find((m) => m.type === 'flex') as {
    type: 'flex';
    contents: { type?: string; contents?: unknown[] };
  };
}

describe('buildMainMenuMessages', () => {
  it('備援選單是三張世界大卡 carousel，不是六宮格按鈕', () => {
    const msgs = buildMainMenuMessages({ body: '測試內文', registered: false });
    const flex = flexFrom(msgs);
    assert.ok(flex);
    assert.equal(flex.contents.type, 'carousel');
    assert.equal(flex.contents.contents?.length, 3);
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /換罐計畫/);
    assert.match(raw, /一起搞事/);
    assert.match(raw, /野放中/);
    assert.doesNotMatch(raw, /訂閱爆罐|領福利|產品導購|粉絲專頁/);
    assert.doesNotMatch(raw, /"type":"button"/);
  });
});

describe('卡片式 ActionCard', () => {
  it('整卡 postback，沒有灰底 button 元件', () => {
    const card = buildActionCard({
      theme: WORLD_THEME.jar,
      mark: '♻️',
      title: '換罐計畫',
      subtitle: '一罐一罐累積。',
      heroKey: 'world-jar',
      action: { type: 'postback', data: 'jd=hub_jar' },
      ctaLabel: '進入',
    });
    assert.equal(card.type, 'bubble');
    assert.ok(card.action);
    assert.ok(card.hero);
    assert.doesNotMatch(JSON.stringify(card), /"type":"button"/);
  });
});

describe('換罐計畫依開戶狀態變形', () => {
  it('未開戶：開戶為主，不出現輸入序號／罐庫', () => {
    const hub = buildJarHubItems(false);
    const ids = hub.items.map((i) => i.id);
    assert.deepEqual(ids, ['jar_explain', 'jar_reg', 'jar_stores', 'jar_faq']);
    assert.equal(hub.primaryId, 'jar_reg');
  });

  it('已開戶：輸入序號為主', () => {
    const hub = buildJarHubItems(true);
    const ids = hub.items.map((i) => i.id);
    assert.deepEqual(ids, ['jar_enter', 'jar_vault', 'jar_history', 'jar_explain']);
    assert.equal(hub.primaryId, 'jar_enter');
  });

  it('Flex 是卡片 carousel', () => {
    const guest = buildWorldHubMessages('jar', { registered: false });
    const flex = flexFrom(guest);
    assert.equal(flex.contents.type, 'carousel');
    assert.equal(flex.contents.contents?.length, 4);
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /幫毛孩開戶/);
    assert.doesNotMatch(raw, /輸入序號/);
    assert.doesNotMatch(raw, /"type":"button"/);

    const member = JSON.stringify(flexFrom(buildWorldHubMessages('jar', { registered: true })));
    assert.match(member, /輸入序號/);
    assert.match(member, /毛孩罐庫/);
  });
});

describe('一起搞事佈告欄', () => {
  it('便利貼式活動卡', () => {
    const flex = flexFrom(buildWorldHubMessages('chaos'));
    assert.equal(flex.contents.type, 'carousel');
    const footer = JSON.stringify(flex.contents);
    assert.match(footer, /嗷嗚計畫/);
    assert.match(footer, /清蛙誰在怕/);
    assert.match(footer, /拍攝指南/);
    assert.match(footer, /完成拿100/);
  });
});

describe('野放中品牌卡', () => {
  it('含社群與店家故事', () => {
    const raw = JSON.stringify(flexFrom(buildWorldHubMessages('wild')));
    assert.match(raw, /Instagram/);
    assert.match(raw, /合作店家/);
    assert.match(raw, /品牌故事/);
  });
});

describe('未開戶擋序號', () => {
  it('單一大卡＋立即開戶', () => {
    const msgs = buildRegisterGateMessages();
    const flex = flexFrom(msgs);
    const raw = JSON.stringify(flex);
    assert.match(raw, /立即開戶|先幫毛孩開戶/);
    assert.match(raw, /next=enter/);
    assert.equal(flex.contents.type, 'carousel');
    assert.equal(flex.contents.contents?.length, 1);
  });
});

describe('什麼是換罐', () => {
  it('四張說明卡', () => {
    const flex = flexFrom(buildJarExplainMessages());
    assert.equal(flex.contents.contents?.length, 4);
    const raw = JSON.stringify(flex);
    assert.match(raw, /介紹/);
    assert.match(raw, /流程/);
    assert.match(raw, /合作店家/);
    assert.match(raw, /常見問題/);
  });
});
