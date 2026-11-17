import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(
  path.join(process.cwd(), 'components/liff/use-liff.ts'),
  'utf8',
);

test('LIFF slow-loading timer stops after authentication succeeds', () => {
  assert.match(
    source,
    /setIdToken\(token\);\s*window\.clearTimeout\(slowTimer\);\s*setState\('ready'\);/,
  );
});

test('LIFF slow-loading timer stops after initialization fails', () => {
  assert.match(
    source,
    /window\.clearTimeout\(slowTimer\);\s*setError\(message\);\s*setState\('error'\);/,
  );
});
