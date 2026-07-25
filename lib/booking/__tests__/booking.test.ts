import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildDaySlots,
  parseHhMm,
  parseWeekdays,
  scheduleFromSettings,
} from '@/lib/booking/availability';
import {
  appointmentStatusLabelForCustomer,
  appointmentStatusLabelForMerchant,
} from '@/lib/booking/constants';

describe('booking availability', () => {
  it('parses HH:mm', () => {
    assert.deepEqual(parseHhMm('09:00'), { hours: 9, minutes: 0 });
    assert.equal(parseHhMm('25:00'), null);
  });

  it('builds shared-merchant slots and marks full for customers', () => {
    const day = new Date(2026, 6, 27, 0, 0, 0, 0); // Monday
    assert.equal(day.getDay(), 1);
    const schedule = {
      openTime: '09:00',
      closeTime: '12:00',
      slotMinutes: 60,
      capacityPerSlot: 1,
      weekdays: [1, 2, 3, 4, 5, 6],
    };
    const occ = new Map<number, number>();
    const nine = new Date(2026, 6, 27, 9, 0, 0, 0);
    occ.set(nine.getTime(), 1);
    const slots = buildDaySlots(day, schedule, occ);
    assert.equal(slots.length, 3);
    assert.equal(slots[0].isFull, true);
    assert.equal(slots[1].isFull, false);
    const customerVisible = slots.filter((s) => !s.isFull);
    assert.equal(customerVisible.length, 2);
  });

  it('reads schedule defaults from settings shape', () => {
    const schedule = scheduleFromSettings({
      bookingOpenTime: '10:00',
      bookingCloseTime: '16:00',
      bookingSlotMinutes: 30,
      bookingCapacityPerSlot: 2,
      bookingWeekdays: '1,3,5',
    } as never);
    assert.equal(schedule.slotMinutes, 30);
    assert.deepEqual(schedule.weekdays, [1, 3, 5]);
    assert.deepEqual(parseWeekdays('0,6'), [0, 6]);
  });
});

describe('booking labels', () => {
  it('uses merchant language', () => {
    assert.equal(appointmentStatusLabelForMerchant('requested'), '待確認');
    assert.equal(appointmentStatusLabelForCustomer('requested'), '等待店家確認');
  });
});
