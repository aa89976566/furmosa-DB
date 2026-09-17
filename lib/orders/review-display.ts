import { record, snapshotHash, type Snapshot } from '../shopify/intake-policy';
import { snapshotView } from '../shopify/snapshot-view';
import { parseFrozenFulfillmentPlan } from './fulfillment-plan';
import { reviewDraft } from './review-policy';
import { normalizeStoredShopifyRecipient } from '../shopify/recipient-name';

/** Display only a saved draft for the current source; never reuse stale contact data. */
export function currentReviewDraft(snapshot: unknown, metadata: string | null | undefined) {
  if (!snapshotView(snapshot)) return null;
  try {
    const saved = record(JSON.parse(metadata ?? '{}'));
    if (saved.schemaVersion !== 1 || saved.sourceHash !== snapshotHash(snapshot as Snapshot)
      || !saved.draft || typeof saved.draft !== 'object' || Array.isArray(saved.draft)) return null;
    const draft = reviewDraft(saved.draft);
    return {
      ...draft,
      recipient: normalizeStoredShopifyRecipient(draft.recipient, snapshot),
    };
  } catch { return null; }
}

/** Saved fulfillment plan is display-only; approve/ship must rebuild and compare. */
export function currentFulfillmentPlan(snapshot: unknown, metadata: string | null | undefined) {
  if (!snapshotView(snapshot)) return null;
  try {
    const saved = record(JSON.parse(metadata ?? '{}'));
    if (saved.schemaVersion !== 1 || saved.sourceHash !== snapshotHash(snapshot as Snapshot)) return null;
    return parseFrozenFulfillmentPlan(saved.fulfillmentPlan);
  } catch { return null; }
}
