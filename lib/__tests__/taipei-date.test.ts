import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addTaipeiCalendarDays,
  taipeiDateInput,
  taipeiTodayRange,
  taipeiWeekRangeSunday,
  taipeiWeekdayIndex,
} from '../taipei-date';

describe('taipei-date dashboard windows', () => {
  it('builds today range in +08:00', () => {
    const { start, end } = taipeiTodayRange(new Date('2026-07-22T16:30:00Z'));
    assert.equal(start.toISOString(), '2026-07-22T16:00:00.000Z');
    assert.equal(end.toISOString(), '2026-07-23T15:59:59.999Z');
  });

  it('starts calendar week on Sunday Taipei time', () => {
    // 2026-07-22 is Wednesday in Taipei
    const ref = new Date('2026-07-22T04:00:00Z');
    assert.equal(taipeiWeekdayIndex(ref), 3);
    const { start, end } = taipeiWeekRangeSunday(ref);
    assert.equal(taipeiDateInput(start), '2026-07-19');
    assert.equal(taipeiDateInput(end), '2026-07-26');
  });

  it('adds calendar days across month boundary', () => {
    assert.equal(addTaipeiCalendarDays('2026-07-31', 1), '2026-08-01');
    assert.equal(addTaipeiCalendarDays('2026-07-22', -3), '2026-07-19');
  });
});
