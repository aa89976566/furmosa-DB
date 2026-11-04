import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveCustomerByPhoneCandidates } from '@/lib/booking/service';

describe('booking customer phone match', () => {
  it('returns null when the phone has no customer', () => {
    assert.equal(resolveCustomerByPhoneCandidates([]), null);
  });

  it('returns the only customer', () => {
    const customer = { id: 'only', lineUserId: null };
    assert.equal(resolveCustomerByPhoneCandidates([customer]), customer);
  });

  it('prefers the unique LINE-linked customer among duplicate phone records', () => {
    const unlinked = { id: 'old-unlinked', lineUserId: null };
    const linked = { id: 'line-member', lineUserId: 'U123' };
    const anotherUnlinked = { id: 'new-unlinked', lineUserId: null };

    assert.equal(
      resolveCustomerByPhoneCandidates([unlinked, linked, anotherUnlinked]),
      linked,
    );
  });

  it('blocks ambiguous duplicates when none are LINE-linked', () => {
    assert.throws(
      () =>
        resolveCustomerByPhoneCandidates([
          { id: 'a', lineUserId: null },
          { id: 'b', lineUserId: null },
        ]),
      /請先到 HQ 整理會員資料/,
    );
  });

  it('blocks ambiguous duplicates when several are LINE-linked', () => {
    assert.throws(
      () =>
        resolveCustomerByPhoneCandidates([
          { id: 'a', lineUserId: 'U1' },
          { id: 'b', lineUserId: 'U2' },
        ]),
      /多個已綁 LINE 的會員/,
    );
  });
});
