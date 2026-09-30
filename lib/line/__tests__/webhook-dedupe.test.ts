import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  claimLineWebhookEvent,
  LINE_WEBHOOK_DEDUPE_TTL_MS,
  releaseLineWebhookEvent,
  resetLineWebhookDedupeForTest,
} from '../webhook-dedupe';

describe('LINE webhook dedupe', () => {
  beforeEach(() => resetLineWebhookDedupeForTest());

  it('同一 webhookEventId 在 TTL 內只處理一次', () => {
    const now = Date.parse('2026-09-30T16:00:00Z');
    assert.equal(claimLineWebhookEvent('evt-1', now), true);
    assert.equal(claimLineWebhookEvent('evt-1', now + 1000), false);
  });

  it('TTL 過後可再次處理', () => {
    const now = Date.parse('2026-09-30T16:00:00Z');
    assert.equal(claimLineWebhookEvent('evt-1', now), true);
    assert.equal(
      claimLineWebhookEvent('evt-1', now + LINE_WEBHOOK_DEDUPE_TTL_MS + 1),
      true,
    );
  });

  it('處理失敗釋放後允許 LINE 重送', () => {
    assert.equal(claimLineWebhookEvent('evt-1', 1000), true);
    releaseLineWebhookEvent('evt-1');
    assert.equal(claimLineWebhookEvent('evt-1', 1001), true);
  });

  it('沒有 event id 時不擋既有 webhook', () => {
    assert.equal(claimLineWebhookEvent(undefined, 1000), true);
    assert.equal(claimLineWebhookEvent(undefined, 1001), true);
  });
});
