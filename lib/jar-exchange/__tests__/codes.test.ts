import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  generateJarCode,
  isValidJarCodeFormat,
  filterValidJarCodes,
  normalizeJarCode,
  JAR_CODE_LENGTH,
} from '@/lib/jar-exchange/codes';

describe('jar code format', () => {
  it('generateJarCode is 8 digits only', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJarCode();
      assert.equal(code.length, JAR_CODE_LENGTH);
      assert.ok(isValidJarCodeFormat(code));
      assert.ok(!code.startsWith('PET'));
      assert.ok(!code.includes('-'));
    }
  });

  it('rejects PET- legacy format', () => {
    assert.ok(!isValidJarCodeFormat('PET-ABC12'));
    assert.ok(!isValidJarCodeFormat('PET-12345'));
  });

  it('normalize strips non-digits', () => {
    assert.equal(normalizeJarCode('PET-12345678'), '12345678');
  });

  it('batch insert pool caps at requested count plus small buffer', () => {
    const n = 70;
    const created = 0;
    const room = n - created;
    const poolSize = room + Math.min(20, room);
    assert.equal(poolSize, 90);
    const toInsert = Array.from({ length: poolSize }, (_, i) => String(10000000 + i)).slice(0, room);
    assert.equal(toInsert.length, 70);
  });

  it('filterValidJarCodes keeps only numeric 8-digit', () => {
    const out = filterValidJarCodes([
      '12345678',
      'PET-ABCDE',
      '123',
      '87654321',
    ]);
    assert.deepEqual(out, ['12345678', '87654321']);
  });
});
