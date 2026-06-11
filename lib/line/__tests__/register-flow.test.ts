import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isRegisterSessionExpired, REGISTER_SESSION_TTL_MS } from '../chat-session';
import { registerStoreStepAction } from '../register-from-chat';

describe('registerStoreStepAction', () => {
  it('取消時結束開戶流程', () => {
    assert.equal(registerStoreStepAction('取消'), 'cancel');
    assert.equal(registerStoreStepAction('cancel'), 'cancel');
  });

  it('一般文字不應重送選店家泡泡', () => {
    assert.equal(registerStoreStepAction('你好'), 'leave');
    assert.equal(registerStoreStepAction('35085664'), 'leave');
    assert.equal(registerStoreStepAction('毛孩來開箱'), 'leave');
    assert.equal(registerStoreStepAction(''), 'leave');
  });
});

describe('isRegisterSessionExpired', () => {
  const now = new Date('2026-06-11T12:00:00Z');

  it('超過 24 小時視為過期', () => {
    const old = new Date(now.getTime() - REGISTER_SESSION_TTL_MS - 1000);
    assert.equal(isRegisterSessionExpired({ updatedAt: old }, now), true);
  });

  it('24 小時內仍有效', () => {
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    assert.equal(isRegisterSessionExpired({ updatedAt: recent }, now), false);
  });
});
