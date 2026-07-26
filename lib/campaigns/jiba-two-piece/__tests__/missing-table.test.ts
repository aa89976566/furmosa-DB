import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMissingCampaignTableError } from '@/lib/campaigns/jiba-two-piece/missing-table';

describe('isMissingCampaignTableError', () => {
  it('detects Prisma P2021', () => {
    assert.equal(
      isMissingCampaignTableError({ code: 'P2021', message: 'table missing' }),
      true,
    );
  });

  it('detects postgres relation missing text', () => {
    assert.equal(
      isMissingCampaignTableError(
        new Error('relation "campaigns" does not exist'),
      ),
      true,
    );
  });

  it('detects Prisma client wording', () => {
    assert.equal(
      isMissingCampaignTableError(
        new Error(
          'The table `public.campaigns` does not exist in the current database.',
        ),
      ),
      true,
    );
  });

  it('ignores unrelated errors', () => {
    assert.equal(isMissingCampaignTableError(new Error('Unique constraint')), false);
    assert.equal(isMissingCampaignTableError({ code: 'P2002' }), false);
  });
});
