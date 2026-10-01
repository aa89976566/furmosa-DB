-- MemberPointsLedger: enforce idempotent source keys (source_type + source_ref_id)
--
-- DEPLOYMENT PRECHECK (run manually on the target DB BEFORE migrate deploy):
--
--   SELECT source_type, source_ref_id, COUNT(*) AS n,
--          array_agg(id) AS ids,
--          array_agg(points_change) AS changes,
--          array_agg(balance_after) AS balances
--   FROM member_points_ledger
--   WHERE source_ref_id IS NOT NULL
--   GROUP BY source_type, source_ref_id
--   HAVING COUNT(*) > 1;
--
-- If any rows are returned: STOP. Do not deploy this migration until duplicates
-- are resolved by a human. This migration does NOT delete or merge rows.
--
-- PostgreSQL UNIQUE allows multiple NULLs in source_ref_id (e.g. manual_adjustment).

DROP INDEX IF EXISTS "member_points_ledger_source_type_source_ref_id_idx";

CREATE UNIQUE INDEX "member_points_ledger_source_type_source_ref_id_key"
  ON "member_points_ledger"("source_type", "source_ref_id");
