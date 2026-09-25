import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ORDER_FORM_DRAFT_MAX_AGE_MS,
  parseOrderFormDraft,
  serializeOrderFormDraft,
} from '../order-form-draft';

test('訂單草稿可以序列化並在有效期限內恢復', () => {
  const savedAt = 1_000_000;
  const raw = serializeOrderFormDraft({ customerId: 'customer-1', note: '請下午送達' }, savedAt);
  const parsed = parseOrderFormDraft<{ customerId: string; note: string }>(raw, savedAt + 500);

  assert.deepEqual(parsed, {
    version: 1,
    savedAt,
    data: { customerId: 'customer-1', note: '請下午送達' },
  });
});

test('過期、未來時間或損壞的草稿不會被載入', () => {
  const savedAt = 1_000_000;
  const raw = serializeOrderFormDraft({ customerId: 'customer-1' }, savedAt);

  assert.equal(parseOrderFormDraft(raw, savedAt + ORDER_FORM_DRAFT_MAX_AGE_MS + 1), null);
  assert.equal(parseOrderFormDraft(raw, savedAt - 1), null);
  assert.equal(parseOrderFormDraft('{not-json', savedAt), null);
  assert.equal(parseOrderFormDraft(JSON.stringify({ version: 99, savedAt, data: {} }), savedAt), null);
});
