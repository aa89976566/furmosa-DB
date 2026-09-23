import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const formSource = readFileSync(
  new URL('../../../components/merchants/pos-password-form.tsx', import.meta.url),
  'utf8',
);

test('POS password reset keeps the server result in client form state', () => {
  assert.match(formSource, /submitPasswordResetWithReceipt\(/);
  assert.match(formSource, /return result\.state/);
  assert.match(formSource, /if \(isNextRedirect\(error\)\) throw error/);
});

test('POS password reset announces success and failure feedback accessibly', () => {
  assert.match(formSource, /aria-live="polite"/);
  assert.match(formSource, /aria-atomic="true"/);
  assert.match(formSource, /role=\{state\.status === 'error' \? 'alert' : 'status'\}/);
});
