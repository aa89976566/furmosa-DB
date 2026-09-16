-- One-time operations cleanup requested on 2026-09-16.
-- Keep orders from the current Taiwan week (Monday 2026-09-14 00:00 UTC+8)
-- in review; move only older orders that are still in a reviewable OMS state.
UPDATE "Order"
SET
  "archived_at" = CURRENT_TIMESTAMP,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "deleted_at" IS NULL
  AND "archived_at" IS NULL
  AND "status" = 'pending_review'
  AND ("oms_status" IS NULL OR "oms_status" IN ('NEW', 'REVIEW'))
  AND "orderedAt" < TIMESTAMP '2026-09-13 16:00:00';
