import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  maskLineUserId,
  resolvePlanRunDate,
  runDateToInstant,
} from '@/lib/line/morning/plan';
import { morningTransactionalWindow } from '@/lib/line/morning/transactional';

describe('Phase 4B-C mask + Taipei calendar', () => {
  it('LINE id 遮罩不回顯全文', () => {
    const masked = maskLineUserId('U0123456789abcdef0123456789abcdef');
    assert.ok(masked.includes('…'));
    assert.ok(!masked.includes('0123456789abcdef0123456789abcdef'));
    assert.ok(masked.startsWith('U01'));
  });

  it('runDate 用 Asia/Taipei，不跟 UTC toISOString 切日', () => {
    // 2026-08-07 16:30 UTC = 2026-08-08 00:30 Taipei
    const utcSide = new Date('2026-08-07T16:30:00.000Z');
    assert.equal(resolvePlanRunDate(utcSide), '2026-08-08');
    assert.notEqual(utcSide.toISOString().slice(0, 10), '2026-08-08');

    // 2026-08-07 15:59 UTC = 2026-08-07 23:59 Taipei
    const before = new Date('2026-08-07T15:59:00.000Z');
    assert.equal(resolvePlanRunDate(before), '2026-08-07');
  });

  it('transactional window 綁定 runDate 全日', () => {
    const w = morningTransactionalWindow('2026-08-08');
    assert.ok(w);
    assert.equal(w!.start.toISOString(), new Date('2026-08-08T00:00:00+08:00').toISOString());
    assert.equal(
      w!.end.toISOString(),
      new Date('2026-08-08T23:59:59.999+08:00').toISOString(),
    );
    const instant = runDateToInstant('2026-08-08');
    assert.ok(instant >= w!.start && instant <= w!.end);
  });
});
