import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildJarDepositHubMessages } from '../flex-menu';

describe('buildJarDepositHubMessages', () => {
  it('returns text fallback when LIFF env is not set', () => {
    const prev = process.env.LINE_LIFF_ID_REGISTER;
    delete process.env.LINE_LIFF_ID_REGISTER;
    delete process.env.LINE_LIFF_ID;

    const msgs = buildJarDepositHubMessages({
      title: '測試',
      body: '內文',
      emphasizeRegister: true,
    });

    assert.equal(msgs.length, 1);
    assert.equal(msgs[0].type, 'text');
    if (msgs[0].type === 'text') {
      assert.match(msgs[0].text, /測試/);
      assert.match(msgs[0].text, /內文/);
    }

    if (prev) process.env.LINE_LIFF_ID_REGISTER = prev;
  });
});
