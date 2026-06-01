import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isMenuOnCooldown, MENU_COOLDOWN_MS } from '../menu-throttle';

describe('isMenuOnCooldown', () => {
  const now = new Date('2026-06-01T12:00:00Z');

  it('從未發過選單時不在冷卻內（應發送）', () => {
    assert.equal(isMenuOnCooldown(null, now), false);
    assert.equal(isMenuOnCooldown(undefined, now), false);
  });

  it('24 小時內已發過 → 仍在冷卻（不重發）', () => {
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    assert.equal(isMenuOnCooldown(oneHourAgo, now), true);

    const justUnder24h = new Date(now.getTime() - (MENU_COOLDOWN_MS - 1000));
    assert.equal(isMenuOnCooldown(justUnder24h, now), true);
  });

  it('超過 24 小時 → 不在冷卻（可再次發送）', () => {
    const justOver24h = new Date(now.getTime() - (MENU_COOLDOWN_MS + 1000));
    assert.equal(isMenuOnCooldown(justOver24h, now), false);

    const twoDaysAgo = new Date(now.getTime() - 2 * MENU_COOLDOWN_MS);
    assert.equal(isMenuOnCooldown(twoDaysAgo, now), false);
  });
});
