-- At most one active (pending|paid) PaymentOrder per (refill_order_id, purpose).
-- failed 可重建；paid 不可再建立第二筆 pending。

-- 1) Deduplicate existing active rows: keep one winner per (refill_order_id, purpose)
--    Prefer paid over pending; then oldest created_at; mark losers as failed.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY refill_order_id, purpose
      ORDER BY
        CASE status WHEN 'paid' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
        created_at ASC,
        id ASC
    ) AS rn
  FROM payment_orders
  WHERE status IN ('pending', 'paid')
)
UPDATE payment_orders po
SET
  status = 'failed',
  updated_at = CURRENT_TIMESTAMP
FROM ranked r
WHERE po.id = r.id
  AND r.rn > 1;

-- 2) Partial unique index (DB-level protection)
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_active_refill_purpose_key"
  ON "payment_orders" ("refill_order_id", "purpose")
  WHERE "status" IN ('pending', 'paid');
