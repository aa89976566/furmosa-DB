import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildJarHubItems } from '../brand-worlds';
import { buildMainMenuMessages } from '../flex-menu';
import {
  buildWorldHubMessages,
  buildRegisterGateMessages,
  buildJarExplainMessages,
} from '../flex-hubs';

describe('buildMainMenuMessages', () => {
  it('聊天備援也只有三世界，不是六宮格', () => {
    const msgs = buildMainMenuMessages({ body: '測試內文', registered: false });
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].type, 'flex');
    if (msgs[0].type === 'flex') {
      const footer = (msgs[0].contents as { footer?: { contents?: unknown[] } }).footer;
      assert.equal(footer?.contents?.length, 3);
      const labels = JSON.stringify(footer.contents);
      assert.match(labels, /換罐計畫/);
      assert.match(labels, /一起搞事/);
      assert.match(labels, /野放中/);
      assert.doesNotMatch(labels, /訂閱爆罐|領福利|產品導購|粉絲專頁/);
    }
  });
});

describe('換罐計畫依開戶狀態變形', () => {
  it('未開戶：開戶為主，不出現輸入序號／罐庫', () => {
    const hub = buildJarHubItems(false);
    const ids = hub.items.map((i) => i.id);
    assert.deepEqual(ids, ['jar_explain', 'jar_reg', 'jar_stores', 'jar_faq']);
    assert.equal(hub.primaryId, 'jar_reg');
    assert.ok(!ids.includes('jar_enter'));
    assert.ok(!ids.includes('jar_vault'));
  });

  it('已開戶：輸入序號為主，不含開戶', () => {
    const hub = buildJarHubItems(true);
    const ids = hub.items.map((i) => i.id);
    assert.deepEqual(ids, ['jar_enter', 'jar_vault', 'jar_history', 'jar_explain']);
    assert.equal(hub.primaryId, 'jar_enter');
    assert.ok(!ids.includes('jar_reg'));
  });

  it('Flex 內容跟狀態一致', () => {
    const guest = JSON.stringify(buildWorldHubMessages('jar', { registered: false }));
    assert.match(guest, /幫毛孩開戶/);
    assert.doesNotMatch(guest, /輸入序號/);

    const member = JSON.stringify(buildWorldHubMessages('jar', { registered: true }));
    assert.match(member, /輸入序號/);
    assert.match(member, /毛孩罐庫/);
    assert.match(member, /換罐紀錄/);
    assert.doesNotMatch(member, /幫毛孩開戶/);
  });
});

describe('一起搞事不含制度', () => {
  it('只有活動項目', () => {
    const msgs = buildWorldHubMessages('chaos');
    const footer = JSON.stringify(
      (msgs[0] as { contents?: { footer?: unknown } }).contents?.footer,
    );
    assert.match(footer, /嗷嗚計畫/);
    assert.match(footer, /清蛙誰在怕/);
    assert.match(footer, /拍攝指南/);
    assert.match(footer, /完成拿100元/);
    assert.doesNotMatch(footer, /幫毛孩開戶|輸入序號|毛孩罐庫/);
  });
});

describe('野放中是品牌入口', () => {
  it('含社群與店家故事', () => {
    const raw = JSON.stringify(buildWorldHubMessages('wild'));
    assert.match(raw, /Instagram/);
    assert.match(raw, /合作店家/);
    assert.match(raw, /品牌故事/);
  });
});

describe('未開戶擋序號', () => {
  it('只有立即開戶一顆鈕', () => {
    const msgs = buildRegisterGateMessages();
    const raw = JSON.stringify(msgs);
    assert.match(raw, /立即開戶/);
    assert.match(raw, /next=enter/);
    assert.match(raw, /先幫毛孩開戶/);
    const footer = (msgs[0] as { contents?: { footer?: { contents?: unknown[] } } }).contents
      ?.footer?.contents;
    assert.equal(footer?.length, 1);
  });
});

describe('什麼是換罐', () => {
  it('有介紹／流程／店家／FAQ 入口', () => {
    const raw = JSON.stringify(buildJarExplainMessages());
    assert.match(raw, /介紹/);
    assert.match(raw, /流程/);
    assert.match(raw, /合作店家/);
    assert.match(raw, /常見問題/);
  });
});
