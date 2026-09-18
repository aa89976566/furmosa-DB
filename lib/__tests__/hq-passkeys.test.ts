import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { NextRequest } from 'next/server';
import {
  HQ_PASSKEY_PRODUCTION_RP_ID,
  passkeyDeviceName,
  resolveHqPasskeyContext,
} from '@/lib/hq-passkeys';

function request(host: string, origin = `https://${host}`) {
  return {
    headers: new Headers({ 'x-forwarded-host': host }),
    nextUrl: { hostname: host, origin },
  } as NextRequest;
}

describe('HQ passkey host policy', () => {
  it('allows only the fixed HQ hostname in production', () => {
    assert.deepEqual(resolveHqPasskeyContext(request('hq.furmosa.com'), 'production'), {
      rpID: HQ_PASSKEY_PRODUCTION_RP_ID,
      origin: 'https://hq.furmosa.com',
    });
    assert.throws(
      () => resolveHqPasskeyContext(request('pos.furmosa.com'), 'production'),
      /只可在 hq\.furmosa\.com/,
    );
    assert.throws(
      () => resolveHqPasskeyContext(request('furmosa-hq-production.up.railway.app'), 'production'),
      /只可在 hq\.furmosa\.com/,
    );
  });

  it('allows local development without widening the production RP', () => {
    assert.deepEqual(
      resolveHqPasskeyContext(request('localhost', 'http://localhost:3000'), 'development'),
      { rpID: 'localhost', origin: 'http://localhost:3000' },
    );
    assert.throws(
      () => resolveHqPasskeyContext(request('preview.example.com'), 'development'),
      /只允許 localhost/,
    );
  });
});

describe('HQ passkey device labels', () => {
  it('uses familiar platform names without claiming biometric data is stored', () => {
    assert.equal(passkeyDeviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)'), 'iPhone／iPad Face ID');
    assert.equal(passkeyDeviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X)'), 'Mac Touch ID');
    assert.equal(passkeyDeviceName('Mozilla/5.0 (Windows NT 10.0)'), 'Windows Hello');
  });
});
