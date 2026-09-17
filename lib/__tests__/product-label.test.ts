import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalProductName, productLabel } from '@/lib/product-label';

describe('product labels', () => {
  it('replaces the legacy pig-ear freeze-dried snapshot with pig-ear strips', () => {
    assert.equal(canonicalProductName('豬耳朵凍乾'), '豬耳朵條');
    assert.equal(productLabel('豬耳朵凍乾', 30), '豬耳朵條 30g');
  });

  it('keeps unrelated product names unchanged', () => {
    assert.equal(canonicalProductName('水晶魚凍乾'), '水晶魚凍乾');
  });
});
