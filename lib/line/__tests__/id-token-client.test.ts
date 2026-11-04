import assert from 'node:assert/strict';
import test from 'node:test';
import { isLineIdTokenUsable } from '../id-token-client';

function tokenWith(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${encoded}.signature`;
}

test('accepts a LINE ID token that remains valid beyond the safety window', () => {
  const nowMs = Date.UTC(2026, 10, 2, 12, 0, 0);
  const exp = Math.floor(nowMs / 1000) + 120;
  assert.equal(isLineIdTokenUsable(tokenWith({ exp }), nowMs), true);
});

test('rejects expired and nearly expired LINE ID tokens', () => {
  const nowMs = Date.UTC(2026, 10, 2, 12, 0, 0);
  const now = Math.floor(nowMs / 1000);
  assert.equal(isLineIdTokenUsable(tokenWith({ exp: now - 1 }), nowMs), false);
  assert.equal(isLineIdTokenUsable(tokenWith({ exp: now + 20 }), nowMs), false);
});

test('rejects malformed tokens and tokens without an expiry', () => {
  assert.equal(isLineIdTokenUsable('not-a-jwt'), false);
  assert.equal(isLineIdTokenUsable(tokenWith({ sub: 'U123' })), false);
});
