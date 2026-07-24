import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMainMenuMessages } from '../flex-menu';
import { buildWorldHubMessages, buildRegisterGateMessages } from '../flex-hubs';

describe('buildMainMenuMessages', () => {
  it('returns three-world flex menu with postback buttons', () => {
    const msgs = buildMainMenuMessages({ body: '測試內文', registered: false });
    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].type, 'flex');
    if (msgs[0].type === 'flex') {
      const footer = (msgs[0].contents as { footer?: { contents?: unknown[] } }).footer;
      assert.ok(footer?.contents && footer.contents.length === 3);
      const labels = JSON.stringify(footer.contents);
      assert.match(labels, /換罐計畫/);
      assert.match(labels, /一起搞事/);
      assert.match(labels, /野放中/);
    }
  });

  it('showJarHint=false 仍回三世界選單', () => {
    const msgs = buildMainMenuMessages({
      body: '測試',
      registered: true,
      showJarHint: false,
    });
    assert.equal(msgs[0].type, 'flex');
  });
});

describe('buildWorldHubMessages', () => {
  it('換罐計畫含開戶與序號', () => {
    const msgs = buildWorldHubMessages('jar', { registered: false });
    const raw = JSON.stringify(msgs);
    assert.match(raw, /幫毛孩開戶/);
    assert.match(raw, /輸入序號/);
    assert.match(raw, /毛孩罐庫/);
    assert.match(raw, /什麼是換罐/);
  });

  it('一起搞事可擴充項目', () => {
    const raw = JSON.stringify(buildWorldHubMessages('chaos'));
    assert.match(raw, /嗷嗚計畫/);
    assert.match(raw, /清蛙誰在怕/);
    assert.match(raw, /拍攝指南/);
  });

  it('野放中含外連', () => {
    const raw = JSON.stringify(buildWorldHubMessages('wild'));
    assert.match(raw, /Instagram/);
    assert.match(raw, /furmosa/);
  });
});

describe('buildRegisterGateMessages', () => {
  it('未開戶擋序號要有立即開戶', () => {
    const raw = JSON.stringify(buildRegisterGateMessages());
    assert.match(raw, /立即開戶/);
    assert.match(raw, /先幫毛孩開戶/);
  });
});
