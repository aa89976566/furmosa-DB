import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isMenuOnCooldown, MENU_COOLDOWN_MS } from '../menu-throttle';
import {
  isPassiveAutoReply,
  PASSIVE_AUTO_REPLY_KINDS,
  shouldSendTriggerReply,
} from '../trigger-throttle';

describe('isPassiveAutoReply', () => {
  it('未知與打招呼不再靜默（改走 recovery 節流）', () => {
    assert.equal(isPassiveAutoReply('unknown'), false);
    assert.equal(isPassiveAutoReply('greeting'), false);
    assert.equal(isPassiveAutoReply('jar_code'), false);
    assert.equal(isPassiveAutoReply('help'), false);
  });

  it('被動類型集合預設為空', () => {
    assert.deepEqual([...PASSIVE_AUTO_REPLY_KINDS], []);
  });
});

describe('shouldSendTriggerReply', () => {
  it('無 lineUserId 時允許回覆', async () => {
    assert.equal(await shouldSendTriggerReply('', 'help'), true);
    assert.equal(await shouldSendTriggerReply('', 'recovery'), true);
  });
});

describe('trigger cooldown logic', () => {
  const now = new Date('2026-06-11T12:00:00Z');

  it('24 小時內視為冷卻', () => {
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    assert.equal(isMenuOnCooldown(recent, now), true);
  });

  it('超過 24 小時可再次觸發', () => {
    const old = new Date(now.getTime() - MENU_COOLDOWN_MS - 1000);
    assert.equal(isMenuOnCooldown(old, now), false);
  });
});
