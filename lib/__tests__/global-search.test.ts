import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  GLOBAL_SEARCH_MAX_LENGTH,
  loadSearchSection,
  normalizeGlobalSearchQuery,
} from '@/lib/global-search';

describe('global search', () => {
  it('normalizes array input and caps expensive queries', () => {
    assert.equal(normalizeGlobalSearchQuery(['  星汪  ', 'ignored']), '星汪');
    assert.equal(normalizeGlobalSearchQuery('店'.repeat(100)).length, GLOBAL_SEARCH_MAX_LENGTH);
  });

  it('keeps other categories usable when one query fails', async () => {
    const reports: string[] = [];
    const failed = await loadSearchSection(
      'orders',
      async () => { throw Object.assign(new Error('private database detail'), { code: 'P2024' }); },
      (section, name, code) => reports.push(`${section}:${name}:${code}`),
    );
    const healthy = await loadSearchSection('merchants', async () => ['星汪樂寵']);

    assert.deepEqual(failed, { status: 'error', items: [] });
    assert.deepEqual(healthy, { status: 'ok', items: ['星汪樂寵'] });
    assert.deepEqual(reports, ['orders:Error:P2024']);
  });
});
