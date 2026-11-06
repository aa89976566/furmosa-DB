import assert from 'node:assert/strict';
import test from 'node:test';
import { selectVisibleLedgerEntry } from '../ledger-selection';

test('filtering out a restock selects the visible paid refill instead', () => {
  const refill = { id: 'refill-paid', amount: 129 };
  assert.equal(selectVisibleLedgerEntry([refill], 'restock-excluded'), refill);
});

test('an empty filter result clears details rather than retaining another transaction', () => {
  assert.equal(selectVisibleLedgerEntry([], 'restock-excluded'), null);
});

test('a merchant-selected visible transaction keeps its details', () => {
  const rows = [{ id: 'a' }, { id: 'b' }];
  assert.equal(selectVisibleLedgerEntry(rows, 'b'), rows[1]);
});

test('changing page limits details to the new page and handles a missing selection', () => {
  const pageTwo = [{ id: 'page-two-a' }, { id: 'page-two-b' }];
  assert.equal(selectVisibleLedgerEntry(pageTwo, 'page-one-a'), pageTwo[0]);
  assert.equal(selectVisibleLedgerEntry(pageTwo, null), pageTwo[0]);
});
