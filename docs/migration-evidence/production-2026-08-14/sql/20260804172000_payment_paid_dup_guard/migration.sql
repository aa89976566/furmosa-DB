-- Guard for environments that already applied an earlier dedup migration:
-- never allow multiple paid rows for the same (refill_order_id, purpose).
-- This migration does not rewrite paid rows.

DO $$
DECLARE
  dup_groups INT;
BEGIN
  SELECT COUNT(*) INTO dup_groups
  FROM (
    SELECT refill_order_id, purpose
    FROM payment_orders
    WHERE status = 'paid'
    GROUP BY refill_order_id, purpose
    HAVING COUNT(*) > 1
  ) d;

  IF dup_groups > 0 THEN
    RAISE EXCEPTION
      'FATAL: % paid+paid group(s) still exist. Run scripts/sql/payment-active-dedup-audit.sql and reconcile before continuing.',
      dup_groups;
  END IF;
END $$;

-- Ensure unique index present (no-op if 20260804160000 already created it)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_active_refill_purpose_key"
  ON "payment_orders" ("refill_order_id", "purpose")
  WHERE "status" IN ('pending', 'paid');
