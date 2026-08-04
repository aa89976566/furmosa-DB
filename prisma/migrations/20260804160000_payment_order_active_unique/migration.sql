-- At most one active (pending|paid) PaymentOrder per (refill_order_id, purpose).
--
-- 會計規則：
--   pending + pending → 保留最舊 pending，其餘改 failed
--   paid + pending    → 保留 paid，pending 改 failed
--   paid + paid       → 禁止自動改寫任何 paid；migration fail-fast，需人工核對金流
--
-- 注意：若此檔曾以不安全版本套用過，部署前請先跑
--   scripts/sql/payment-active-dedup-audit.sql
-- 確認 paid_plus_paid_groups = 0。

-- 0) paid + paid → 立即失敗（不得自動把 paid 改 failed）
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
      'FATAL: % group(s) have multiple paid payment_orders for the same (refill_order_id, purpose). Manual payment reconciliation required. Do not auto-fail paid rows. Run scripts/sql/payment-active-dedup-audit.sql',
      dup_groups;
  END IF;
END $$;

-- 1a) paid + pending → 僅將 pending 標 failed（绝不 UPDATE status='paid'）
UPDATE payment_orders po
SET
  status = 'failed',
  updated_at = CURRENT_TIMESTAMP
WHERE po.status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM payment_orders paid
    WHERE paid.refill_order_id = po.refill_order_id
      AND paid.purpose = po.purpose
      AND paid.status = 'paid'
  );

-- 1b) pending + pending（且該組無 paid）→ 保留最舊 pending，其餘 pending 改 failed
WITH ranked_pending AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY refill_order_id, purpose
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM payment_orders
  WHERE status = 'pending'
    AND NOT EXISTS (
      SELECT 1
      FROM payment_orders paid
      WHERE paid.refill_order_id = payment_orders.refill_order_id
        AND paid.purpose = payment_orders.purpose
        AND paid.status = 'paid'
    )
)
UPDATE payment_orders po
SET
  status = 'failed',
  updated_at = CURRENT_TIMESTAMP
FROM ranked_pending r
WHERE po.id = r.id
  AND r.rn > 1;

-- 2) Partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_active_refill_purpose_key"
  ON "payment_orders" ("refill_order_id", "purpose")
  WHERE "status" IN ('pending', 'paid');
