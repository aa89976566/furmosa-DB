import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  frequencyMatchesDay,
  hashLineUserId,
  isSlotDue,
  isWithinMorningWindow,
  isWeeklySendDay,
  morningSlotMinute,
} from '../schedule';

describe('morning schedule', () => {
  it('deterministic slot 0–29', () => {
    const a = morningSlotMinute('Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const b = morningSlotMinute('Uaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    const c = morningSlotMinute('Ubbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
    assert.equal(a, b);
    assert.ok(a >= 0 && a <= 29);
    assert.ok(c >= 0 && c <= 29);
    assert.equal(hashLineUserId('Ux'), hashLineUserId('Ux'));
  });

  it('台北早晨窗與 slot due', () => {
    // 2026-08-07 00:15 UTC = 08:15 Taipei
    const inside = new Date('2026-08-07T00:15:00.000Z');
    assert.equal(isWithinMorningWindow(inside), true);
    // 07:59 Taipei
    assert.equal(isWithinMorningWindow(new Date('2026-08-06T23:59:00.000Z')), false);
    // 08:30 Taipei
    assert.equal(isWithinMorningWindow(new Date('2026-08-07T00:30:00.000Z')), false);

    const id = 'Ucccccccccccccccccccccccccccccccc';
    const slot = morningSlotMinute(id);
    const dueTime = new Date(
      Date.UTC(2026, 7, 7, 0, slot), // 08:slot Taipei
    );
    assert.equal(isSlotDue(id, dueTime), true);
    if (slot > 0) {
      const before = new Date(Date.UTC(2026, 7, 7, 0, slot - 1));
      assert.equal(isSlotDue(id, before), false);
    }
  });

  it('平日／週末／每週五', () => {
    // 2026-08-07 = Friday Taipei
    const fri = new Date('2026-08-07T00:10:00.000Z');
    assert.equal(isWeeklySendDay(fri), true);
    assert.equal(frequencyMatchesDay('weekly', fri), true);
    assert.equal(frequencyMatchesDay('weekday', fri), true);
    assert.equal(frequencyMatchesDay('daily', fri), true);

    // 2026-08-08 = Saturday Taipei
    const sat = new Date('2026-08-08T00:10:00.000Z');
    assert.equal(frequencyMatchesDay('weekday', sat), false);
    assert.equal(frequencyMatchesDay('weekly', sat), false);
    assert.equal(frequencyMatchesDay('daily', sat), true);
  });
});
