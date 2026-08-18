import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { GROOMING_ENTRY_BODY, GROOMING_ENTRY_TITLE, GROOMING_PREVIEW_HREF } from '../copy';
import { VOUCHER_FACE_BY_TIER } from '../fixtures';
import { serviceTotalExceedsFace } from '../validators';

describe('merchant POS preview grooming voucher entry', () => {
  it('links to the existing grooming voucher preview', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'components/merchant-pos-preview/more-panel.tsx'),
      'utf8',
    );
    assert.match(src, /GROOMING_PREVIEW_HREF/);
    assert.equal(GROOMING_PREVIEW_HREF, '/preview/grooming-voucher');
    assert.equal(GROOMING_ENTRY_TITLE, '美容服務券');
    assert.match(GROOMING_ENTRY_BODY, /美容服務券/);
    assert.match(GROOMING_ENTRY_BODY, /不是商品折價券/);
    assert.match(src, /GROOMING_ENTRY_BODY/);
    assert.equal(src.includes('商品折價券'), false);
    assert.equal(src.includes('豬窩'), false);
  });

  it('keeps the local face-value rule: 201 passes and 200 or less fails', () => {
    assert.equal(VOUCHER_FACE_BY_TIER.standard_200, 200);
    assert.equal(serviceTotalExceedsFace(201, 200), true);
    assert.equal(serviceTotalExceedsFace(200, 200), false);
    assert.equal(serviceTotalExceedsFace(199, 200), false);
    assert.equal(serviceTotalExceedsFace(251, 250), true);
    assert.equal(serviceTotalExceedsFace(250, 250), false);
  });
});
