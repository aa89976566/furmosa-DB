import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  emptyHumorSourceFields,
  validateSourceContract,
  type MorningSourceFields,
} from '../domain/source-contract';

const HASH =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function validExternal(overrides: Partial<MorningSourceFields> = {}): MorningSourceFields {
  return {
    provider: 'example-provider',
    itemId: 'item-1',
    canonicalUrl: 'https://example.org/a',
    licenseType: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attribution: 'Example Org',
    contentHash: HASH,
    sourcePublishedAt: new Date('2026-08-01T00:00:00.000Z'),
    retrievedAt: new Date('2026-08-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('Phase 4B-A source field contract', () => {
  it('NEWS 需要完整來源欄位與 sourcePublishedAt', () => {
    assert.equal(validateSourceContract('NEWS', validExternal()).ok, true);
    const missingPub = validateSourceContract(
      'NEWS',
      validExternal({ sourcePublishedAt: null }),
    );
    assert.equal(missingPub.ok, false);
    if (!missingPub.ok) {
      assert.ok(missingPub.reasons.includes('missing_sourcePublishedAt'));
    }
  });

  it('ANIMAL_FACT 允許 sourcePublishedAt=null；retrievedAt 不冒充發布日', () => {
    const fact = validExternal({ sourcePublishedAt: null });
    assert.equal(validateSourceContract('ANIMAL_FACT', fact).ok, true);
    // retrievedAt 可存在且與 published 分開
    assert.ok(fact.retrievedAt instanceof Date);
    assert.equal(fact.sourcePublishedAt, null);
  });

  it('HUMOR 所有外部來源欄位必須為 null', () => {
    assert.equal(validateSourceContract('HUMOR', emptyHumorSourceFields()).ok, true);
    const bad = validateSourceContract(
      'HUMOR',
      emptyHumorSourceFields(),
    );
    assert.equal(bad.ok, true);
    const withUrl = validateSourceContract('HUMOR', {
      ...emptyHumorSourceFields(),
      canonicalUrl: 'https://example.org/x',
    });
    assert.equal(withUrl.ok, false);
  });

  it('缺 provider／license／hash 時 fail-closed', () => {
    const r = validateSourceContract(
      'NEWS',
      validExternal({ provider: '', licenseType: null, contentHash: 'nope' }),
    );
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.ok(r.reasons.includes('missing_provider'));
      assert.ok(r.reasons.includes('missing_licenseType'));
      assert.ok(r.reasons.includes('invalid_contentHash'));
    }
  });
});
