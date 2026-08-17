import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import { verifyLineSignature } from '@/lib/line/verify-signature';

describe('verifyLineSignature', () => {
  const secret = 'test-channel-secret';
  const body = '{"events":[]}';
  const valid = createHmac('sha256', secret).update(body).digest('base64');

  it('accepts a matching HMAC and rejects missing or wrong signatures', () => {
    assert.equal(verifyLineSignature(body, valid, secret), true);
    assert.equal(verifyLineSignature(body, null, secret), false);
    assert.equal(verifyLineSignature(body, '', secret), false);
    assert.equal(verifyLineSignature(body, 'AAAA', secret), false);
    assert.equal(verifyLineSignature('{"events":[1]}', valid, secret), false);
  });
});
