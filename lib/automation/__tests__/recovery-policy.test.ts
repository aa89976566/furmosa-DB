import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUTOMATION_RETRY_DELAY_MS,
  decideRecovery,
  normalizeAutomationError,
} from '../recovery-policy';

test('成功立即完成', () => {
  assert.deepEqual(decideRecovery(1, true), { action: 'complete' });
});

test('第一次失敗在 30 秒後重試', () => {
  const now = new Date('2026-09-25T00:00:00.000Z');
  assert.deepEqual(decideRecovery(1, false, now), {
    action: 'retry',
    nextAttemptAt: new Date(now.getTime() + AUTOMATION_RETRY_DELAY_MS),
  });
});

test('第二次失敗啟用安全替代方案', () => {
  assert.deepEqual(decideRecovery(2, false), { action: 'fallback' });
});

test('錯誤訊息遮蔽 bearer token 並限制長度', () => {
  const text = normalizeAutomationError(new Error(`Bearer secret-token ${'x'.repeat(600)}`));
  assert.equal(text.includes('secret-token'), false);
  assert.ok(text.length <= 500);
});
