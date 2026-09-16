-- Follow-up for legacy orders whose OMS state did not match their visible
-- pending-review state. The operator requirement is date-based: every order
-- before the current Taiwan week belongs in history, regardless of legacy OMS
-- metadata. Preserve the records and only remove them from the active queue.
UPDATE "Order"
SET
  "archived_at" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "deleted_at" IS NULL
  AND "archived_at" IS NULL
  AND "status" = 'pending_review'
  AND "orderedAt" < TIMESTAMP '2026-09-13 16:00:00';
