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

describe('capacity race rule', () => {
  it('customer path treats occupied >= capacity as full', () => {
    const day = new Date(2026, 6, 27, 0, 0, 0, 0);
    const schedule = {
      openTime: '09:00',
      closeTime: '11:00',
      slotMinutes: 60,
      capacityPerSlot: 1,
      weekdays: [1],
    };
    const nine = new Date(2026, 6, 27, 9, 0, 0, 0);
    const occ = new Map([[nine.getTime(), 1]]);
    const slots = buildDaySlots(day, schedule, occ);
    const customerSlots = slots.filter((s) => !s.isFull);
    assert.equal(customerSlots.some((s) => s.startsAt.getTime() === nine.getTime()), false);
    // merchant may still see the full slot for overbook
    assert.equal(slots.find((s) => s.startsAt.getTime() === nine.getTime())?.isFull, true);
  });
});

describe('booking LINE notify copy / reminder windows', () => {
  it('builds customer received / merchant new / confirmed copy', async () => {
    const {
      copyCustomerReceived,
      copyMerchantNewRequest,
      copyCustomerConfirmed,
      copyReminder1d,
      copyReminder2h,
      isInReminder1dWindow,
      isInReminder2hWindow,
    } = await import('@/lib/booking/notify-copy');
    const startsAt = new Date(2026, 6, 28, 10, 0, 0, 0);
    const ctx = {
      merchantName: '測試店',
      serviceName: '美容',
      startsAt,
      petName: '豆豆',
      customerName: '小明',
    };
    assert.match(copyCustomerReceived(ctx), /已收到你的預約申請/);
    assert.match(copyMerchantNewRequest(ctx), /有新的預約申請/);
    assert.match(copyCustomerConfirmed(ctx), /預約已確認/);
    assert.match(copyReminder1d(ctx), /明天有預約/);
    assert.match(copyReminder2h(ctx), /兩小時後有預約/);

    // 1d = 台北日曆「明天」；2h = 90～150 分鐘視窗
    const dayBefore = new Date(2026, 6, 27, 12, 0, 0, 0);
    assert.equal(isInReminder1dWindow(startsAt, dayBefore), true);
    assert.equal(isInReminder2hWindow(startsAt, dayBefore), false);
    const near = new Date(startsAt.getTime() - 2 * 60 * 60 * 1000);
    assert.equal(isInReminder2hWindow(startsAt, near), true);
    assert.equal(isInReminder1dWindow(startsAt, near), false);
  });
});
