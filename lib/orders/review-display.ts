import { record, snapshotHash, type Snapshot } from '../shopify/intake-policy';
import { snapshotView } from '../shopify/snapshot-view';
import { reviewDraft } from './review-policy';

/** Display only a saved draft for the current source; never reuse stale contact data. */
export function currentReviewDraft(snapshot: unknown, metadata: string | null | undefined) {
  if (!snapshotView(snapshot)) return null;
  try {
    const saved = record(JSON.parse(metadata ?? '{}'));
    if (saved.schemaVersion !== 1 || saved.sourceHash !== snapshotHash(snapshot as Snapshot)
      || !saved.draft || typeof saved.draft !== 'object' || Array.isArray(saved.draft)) return null;
    return reviewDraft(saved.draft);
  } catch { return null; }
}
