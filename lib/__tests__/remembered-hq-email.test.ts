import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  HQ_REMEMBERED_EMAIL_KEY,
  readRememberedHqEmail,
  writeRememberedHqEmail,
} from '../hq/remembered-email';

describe('remembered HQ email', () => {
  it('reads and writes the trimmed email', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    writeRememberedHqEmail('  admin@furmosa.com  ', storage);
    assert.equal(store.get(HQ_REMEMBERED_EMAIL_KEY), 'admin@furmosa.com');
    assert.equal(readRememberedHqEmail(storage), 'admin@furmosa.com');
  });

  it('does not store a blank email or throw without storage', () => {
    writeRememberedHqEmail('   ', null);
    writeRememberedHqEmail('admin@furmosa.com', null);
    assert.equal(readRememberedHqEmail(null), '');
  });
});
