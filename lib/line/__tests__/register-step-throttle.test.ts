import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { REGISTER_SESSION_TTL_MS } from '../chat-session';
import {
  isRegisterStepPromptOnCooldown,
  markRegisterStepPrompt,
} from '../register-step-throttle';

describe('register step prompt throttle', () => {
  const now = new Date('2026-07-01T08:00:00Z');

  it('首次提示不在冷卻內', () => {
    assert.equal(isRegisterStepPromptOnCooldown({}, 'pet_age', now), false);
  });

  it('24 小時內同一步驟不再提示', () => {
    const draft = markRegisterStepPrompt({}, 'pet_age', now);
    const later = new Date(now.getTime() + 60 * 60 * 1000);
    assert.equal(isRegisterStepPromptOnCooldown(draft, 'pet_age', later), true);
  });

  it('超過 24 小時可再次提示', () => {
    const draft = markRegisterStepPrompt({}, 'pet_age', now);
    const after = new Date(now.getTime() + REGISTER_SESSION_TTL_MS + 1);
    assert.equal(isRegisterStepPromptOnCooldown(draft, 'pet_age', after), false);
  });

  it('不同步驟各自計時', () => {
    const draft = markRegisterStepPrompt({}, 'pet_age', now);
    assert.equal(isRegisterStepPromptOnCooldown(draft, 'phone', now), false);
  });
});
