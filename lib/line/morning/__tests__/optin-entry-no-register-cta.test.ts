import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 4B-B entry：禁止註冊／bind 自動偏好 CTA', () => {
  it('register-from-chat 不含 startMorningPreferenceFlow 與早安邀請句', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'lib/line/register-from-chat.ts'),
      'utf8',
    );
    assert.ok(!src.includes('startMorningPreferenceFlow'));
    assert.ok(!src.includes('早上要不要收一則毛孩短訊'));
    assert.ok(!src.includes('寵物笑話／全球寵物新鮮事'));
  });

  it('handle-event bind 路徑不含偏好自動啟動', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'lib/line/handle-event.ts'),
      'utf8',
    );
    assert.ok(!src.includes('startMorningPreferenceFlow'));
    assert.ok(!src.includes('shouldPromptPreference'));
    assert.ok(src.includes('禁止偏好 CTA') || src.includes('CONSENSUS'));
  });
});
