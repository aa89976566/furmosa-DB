import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { mapRefillErrorToCopy, REFILL_COPY } from '../copy';

describe('REFILL_COPY no-booking UX', () => {
  it('說明需店家確認預約，且不暗示可線上預約', () => {
    assert.match(REFILL_COPY.noBooking, /合作店家|店家/);
    assert.match(REFILL_COPY.noBooking, /確認/);
    assert.match(REFILL_COPY.noBooking, /還不能直接約|不能直接約/);
    assert.doesNotMatch(REFILL_COPY.noBooking, /現在就能約|可以線上預約|立刻預約/);
    assert.match(REFILL_COPY.noBookingNext, /合作店家/);
    assert.match(REFILL_COPY.noBookingNext, /別急著再付/);
    assert.equal(REFILL_COPY.viewPartnerStores, '查看合作店家');
    assert.equal(REFILL_COPY.backToJarMenu, '回到換罐選單');
  });

  it('mapRefillErrorToCopy 使用同一套無預約文案', () => {
    assert.equal(mapRefillErrorToCopy('NO_BOOKING'), REFILL_COPY.noBooking);
    assert.equal(
      mapRefillErrorToCopy('BOOKING_NOT_CONFIRMED'),
      REFILL_COPY.bookingNotConfirmed,
    );
  });
});
