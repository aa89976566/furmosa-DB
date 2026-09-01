import assert from 'node:assert/strict';
import test from 'node:test';
import { validateRestockReceipt } from '@/lib/pos/restock-receipt';

test('accepts a receipt that exactly matches the shipment', () => {
  assert.doesNotThrow(() =>
    validateRestockReceipt(
      [
        { lineId: 'line-1', expectedQuantity: 2 },
        { lineId: 'line-2', expectedQuantity: 1 },
      ],
      new Map([
        ['line-1', 2],
        ['line-2', 1],
      ]),
    ),
  );
});

test('rejects missing, damaged, or unexpected quantities', () => {
  assert.throws(
    () =>
      validateRestockReceipt(
        [{ lineId: 'line-1', expectedQuantity: 2 }],
        new Map([['line-1', 1]]),
      ),
    /實收數量與出貨單不符/,
  );
  assert.throws(
    () =>
      validateRestockReceipt(
        [{ lineId: 'line-1', expectedQuantity: 2 }],
        new Map([['other', 2]]),
      ),
    /驗收品項與出貨單不符/,
  );
});
