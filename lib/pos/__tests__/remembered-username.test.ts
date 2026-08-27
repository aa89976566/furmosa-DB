import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  POS_REMEMBERED_USERNAME_KEY,
  readRememberedPosUsername,
  writeRememberedPosUsername,
} from '@/lib/pos/remembered-username';

describe('remembered POS username', () => {
  it('reads and writes the trimmed username', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    };
    writeRememberedPosUsername('  paopao  ', storage);
    assert.equal(store.get(POS_REMEMBERED_USERNAME_KEY), 'paopao');
    assert.equal(readRememberedPosUsername(storage), 'paopao');
  });

  it('does not store a blank username or throw without storage', () => {
    writeRememberedPosUsername('   ', null);
    writeRememberedPosUsername('paopao', null);
    assert.equal(readRememberedPosUsername(null), '');
  });
});
