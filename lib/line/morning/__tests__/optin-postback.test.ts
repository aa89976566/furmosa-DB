import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  buildMorningOptinPostbackData,
  buildMorningOptinQuickReplyItems,
  resetMorningOptinNonceCacheForTests,
  verifyMorningOptinPostback,
} from '../optin-postback';

const SECRET = 'test-secret-for-morning-optin-postback-32b';
const UID = 'U_TEST_user_1';

describe('morning opt-in postback 防偽與重播', () => {
  beforeEach(() => {
    resetMorningOptinNonceCacheForTests();
  });

  it('合法 postback 通過；竄改 mode／uid 失敗', () => {
    const { data, nonce } = buildMorningOptinPostbackData({
      mode: 'news_first_fact_fallback',
      lineUserId: UID,
      secret: SECRET,
    });
    const ok = verifyMorningOptinPostback({
      data,
      expectedLineUserId: UID,
      expectedNonce: nonce,
      secret: SECRET,
    });
    assert.equal(ok.ok, true);

    resetMorningOptinNonceCacheForTests();
    const tampered = data.replace('news_first_fact_fallback', 'jokes');
    const bad = verifyMorningOptinPostback({
      data: tampered,
      expectedLineUserId: UID,
      expectedNonce: nonce,
      secret: SECRET,
    });
    assert.equal(bad.ok, false);
    if (!bad.ok) assert.equal(bad.reason, 'bad_signature');

    const { data: d2, nonce: n2 } = buildMorningOptinPostbackData({
      mode: 'jokes',
      lineUserId: UID,
      secret: SECRET,
    });
    const wrongUid = verifyMorningOptinPostback({
      data: d2,
      expectedLineUserId: 'U_OTHER',
      expectedNonce: n2,
      secret: SECRET,
    });
    assert.equal(wrongUid.ok, false);
  });

  it('重播同一 nonce 被拒；過期被拒', () => {
    const { data, nonce } = buildMorningOptinPostbackData({
      mode: 'jokes',
      lineUserId: UID,
      secret: SECRET,
      ttlSec: 60,
    });
    const first = verifyMorningOptinPostback({
      data,
      expectedLineUserId: UID,
      expectedNonce: nonce,
      secret: SECRET,
    });
    assert.equal(first.ok, true);
    const replay = verifyMorningOptinPostback({
      data,
      expectedLineUserId: UID,
      expectedNonce: nonce,
      secret: SECRET,
    });
    assert.equal(replay.ok, false);
    if (!replay.ok) assert.equal(replay.reason, 'replay');

    resetMorningOptinNonceCacheForTests();
    const expired = buildMorningOptinPostbackData({
      mode: 'off',
      lineUserId: UID,
      secret: SECRET,
      now: new Date('2020-01-01T00:00:00Z'),
      ttlSec: 10,
    });
    const exp = verifyMorningOptinPostback({
      data: expired.data,
      expectedLineUserId: UID,
      expectedNonce: expired.nonce,
      secret: SECRET,
      now: new Date('2020-01-01T01:00:00Z'),
    });
    assert.equal(exp.ok, false);
    if (!exp.ok) assert.equal(exp.reason, 'expired');
  });

  it('quick-reply 五鍵 label ≤20 且含 FACT mixed／OFF；不預設勾選', () => {
    const { items } = buildMorningOptinQuickReplyItems(UID);
    assert.equal(items.length, 5);
    for (const it of items) {
      assert.ok(it.action.label.length <= 20, it.action.label);
      assert.match(it.action.data, /^morning=1&/);
    }
    const modes = items.map((i) => new URLSearchParams(i.action.data).get('mode'));
    assert.deepEqual(modes, [
      'jokes',
      'news',
      'news_first_fact_fallback',
      'news_first_fact_or_humor_fallback',
      'off',
    ]);
    assert.ok(!modes.includes('alternate'));
  });
});
