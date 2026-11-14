import test from 'node:test';
import assert from 'node:assert/strict';
import { adoptionHeaders, publicAnimal } from '../adoption/public-response';

test('public adoption response excludes database/private metadata', () => {
  const a = publicAnimal({ data: { id: '1', name: 'rabbit', secret: 'never-public', behavior: ['source text', 1] }, lastCheckedAt: new Date('2026-11-13T00:00:00Z'), sourceStatus: '限定資格領養' });
  assert.equal(a.status, '限定資格領養'); assert.equal('secret' in a, false); assert.deepEqual(a.behavior, ['source text']);
});
test('only store origins receive CORS; no credentials', () => {
  assert.equal(adoptionHeaders('https://furmosa.com')['Access-Control-Allow-Origin'], 'https://furmosa.com');
  assert.equal('Access-Control-Allow-Origin' in adoptionHeaders('https://evil.example'), false);
  assert.equal('Access-Control-Allow-Credentials' in adoptionHeaders('https://furmosa.com'), false);
});
