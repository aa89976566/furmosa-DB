import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const source = fs.readFileSync(path.join(process.cwd(), 'app/(main)/products/shopify-candidates/page.tsx'), 'utf8');

test('candidate list is grouped by Shopify product and exposes safe statuses', () => {
  assert.match(source, /groups = new Map/);
  assert.match(source, /shopifyProductId/);
  assert.match(source, /visibleProductIds/);
  assert.match(source, /resolution: \{ in: \['pending', 'linked', 'blocked', 'created'\] \}/);
  assert.match(source, /待確認/);
  assert.match(source, /已連結/);
  assert.match(source, /這次不建立/);
});

test('candidate list does not offer bulk creation', () => {
  assert.doesNotMatch(source, /全部建立/);
  assert.doesNotMatch(source, /自動連結/);
});
