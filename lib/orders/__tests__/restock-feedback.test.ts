import assert from 'node:assert/strict';
import test from 'node:test';
import { restockWithFeedbackUsing, RESTOCK_UNKNOWN_RESULT } from '../restock-feedback';
import { restockRecipientFromForm } from '../parse-restock-form';

test('missing recipient produces actionable feedback instead of a render failure', async () => {
  const data = new FormData();
  data.set('note', 'keep my note');
  const result = await restockWithFeedbackUsing(async () => { throw new Error('請填寫收件人電話'); }, data);
  assert.deepEqual(result, { status: 'error', message: '請填寫收件人電話' });
  assert.equal(data.get('note'), 'keep my note');
});

test('unexpected failures do not leak internal errors or encourage blind retry', async () => {
  const result = await restockWithFeedbackUsing(async () => { throw new Error('private database host'); }, new FormData());
  assert.equal(result.message, RESTOCK_UNKNOWN_RESULT);
});

test('navigation remains a framework redirect', async () => {
  const redirect = { digest: 'NEXT_REDIRECT;replace;/shipments?s=fixture;303;' };
  await assert.rejects(restockWithFeedbackUsing(async () => { throw redirect; }, new FormData()), e => e === redirect);
});

test('shipment-only recipient overrides do not change source profile', () => {
  const profile = { recipientName: 'old', recipientPhone: null, recipientAddress: null };
  const data = new FormData();
  data.set('recipientName', ' new ');
  data.set('recipientPhone', ' 0900000000 ');
  data.set('recipientAddress', ' preview only ');
  assert.deepEqual(restockRecipientFromForm(data, profile), {
    recipientName: 'new', recipientPhone: '0900000000', recipientAddress: 'preview only',
  });
  assert.equal(profile.recipientPhone, null);
});

test('legacy forms preserve defaults; explicitly cleared fields stay empty for validation', () => {
  const profile = { recipientName: 'old', recipientPhone: '0900000000', recipientAddress: 'address' };
  assert.deepEqual(restockRecipientFromForm(new FormData(), profile), profile);
  const data = new FormData();
  data.set('recipientPhone', ' ');
  assert.equal(restockRecipientFromForm(data, profile).recipientPhone, null);
});
