import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_HQ_SESSION_DAYS,
  HQ_SESSION_MAX_AGE_SECONDS,
  resolveHqSessionDays,
} from '../hq-session-policy';

test('HQ 預設在同一裝置保持登入 180 天', () => {
  assert.equal(DEFAULT_HQ_SESSION_DAYS, 180);
  assert.equal(resolveHqSessionDays(undefined), 180);
  assert.equal(HQ_SESSION_MAX_AGE_SECONDS, 180 * 24 * 60 * 60);
});

test('HQ 登入期限只接受 1 至 365 天的完整天數', () => {
  assert.equal(resolveHqSessionDays('30'), 30);
  for (const invalid of ['0', '366', '-1', '1.5', 'abc']) {
    assert.equal(resolveHqSessionDays(invalid), DEFAULT_HQ_SESSION_DAYS);
  }
});
