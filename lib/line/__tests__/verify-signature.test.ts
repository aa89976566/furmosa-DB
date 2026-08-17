import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { verifyLineSignature } from '../verify-signature';

const SECRET = 'synthetic-line-channel-secret';
const BODY = '{"events":[{"type":"message","message":{"type":"text","text":"開箱"}}]}';

function sign(body: string, secret: string) {
  return createHmac('sha256', secret).update(body).digest('base64');
}

describe('verifyLineSignature', () => {
  it('accepts a matching LINE signature', () => {
    assert.equal(verifyLineSignature(BODY, sign(BODY, SECRET), SECRET), true);
  });

  it('rejects missing, wrong, or truncated signatures', () => {
    assert.equal(verifyLineSignature(BODY, null, SECRET), false);
    assert.equal(verifyLineSignature(BODY, '', SECRET), false);
    assert.equal(verifyLineSignature(BODY, sign(BODY, 'other-secret'), SECRET), false);
    assert.equal(verifyLineSignature(BODY, sign('{"events":[]}', SECRET), SECRET), false);
    assert.equal(verifyLineSignature(BODY, 'abc', SECRET), false);
  });

  it('webhook router still verifies signature before handling events', () => {
    const src = readFileSync(new URL('../../../app/api/line/webhook/route.ts', import.meta.url), 'utf8');
    assert.match(src, /verifyLineSignature/);
    assert.match(src, /x-line-signature/);
    assert.match(src, /handleLineWebhookEvent/);
  });

  it('handle-event no longer uses fuzzy includes 開箱', () => {
    const src = readFileSync(new URL('../handle-event.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(src, /includes\(\s*['"]開箱['"]\s*\)/);
    assert.match(src, /parsed\.kind === 'jiba_unbox'/);
  });
});
