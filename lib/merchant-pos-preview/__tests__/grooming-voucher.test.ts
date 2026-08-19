import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { GROOMING_ENTRY_BODY, GROOMING_ENTRY_TITLE, GROOMING_PREVIEW_HREF } from '../copy';

describe('merchant POS preview grooming voucher entry', () => {
  it('keeps a single link to the existing grooming voucher preview', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/more-panel.tsx'),
      'utf8',
    );
    const types = readFileSync(path.join(process.cwd(), 'lib/merchant-pos-preview/types.ts'), 'utf8');
    const fixtures = readFileSync(path.join(process.cwd(), 'lib/merchant-pos-preview/fixtures.ts'), 'utf8');
    const validators = readFileSync(
      path.join(process.cwd(), 'lib/merchant-pos-preview/validators.ts'),
      'utf8',
    );
    assert.match(src, /GROOMING_PREVIEW_HREF/);
    assert.equal(GROOMING_PREVIEW_HREF, '/preview/grooming-voucher');
    assert.equal(GROOMING_ENTRY_TITLE, '美容服務券');
    assert.match(GROOMING_ENTRY_BODY, /美容服務券/);
    assert.match(GROOMING_ENTRY_BODY, /不是商品折價券/);
    assert.equal(src.includes('商品折價券'), false);
    assert.equal(src.includes('豬窩'), false);
    assert.equal(types.includes('VoucherFaceTier'), false);
    assert.equal(fixtures.includes('VOUCHER_FACE_BY_TIER'), false);
    assert.equal(validators.includes('serviceTotalExceedsFace'), false);
  });
});
