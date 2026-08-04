-- Read-only audit BEFORE applying payment unique / after unsafe dedup.
-- 不輸出顧客個資、不輸出金鑰／callback payload。
-- 目標：找出同一 (refill_order_id, purpose) 的重複 active 付款。

-- A) 重複組摘要
SELECT
  refill_order_id,
  purpose,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_n,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_n,
  COUNT(*) AS active_n,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'paid') >= 2 THEN 'PAID_PLUS_PAID_BLOCK'
    WHEN COUNT(*) FILTER (WHERE status = 'paid') = 1
     AND COUNT(*) FILTER (WHERE status = 'pending') >= 1 THEN 'PAID_PLUS_PENDING'
    WHEN COUNT(*) FILTER (WHERE status = 'pending') >= 2 THEN 'PENDING_PLUS_PENDING'
    ELSE 'OK'
  END AS conflict_class
FROM payment_orders
WHERE status IN ('pending', 'paid')
GROUP BY refill_order_id, purpose
HAVING COUNT(*) > 1
ORDER BY conflict_class, refill_order_id, purpose;

-- B) 明細（僅 id／金額／狀態／時間）
SELECT
  po.refill_order_id,
  po.purpose,
  po.id AS payment_order_id,
  po.status,
  po.amount,
  po.created_at,
  po.paid_at,
  LEFT(po.merchant_trade_no, 4) || '…' AS merchant_trade_no_prefix
FROM payment_orders po
WHERE po.status IN ('pending', 'paid')
  AND EXISTS (
    SELECT 1
    FROM payment_orders x
    WHERE x.refill_order_id = po.refill_order_id
      AND x.purpose = po.purpose
      AND x.status IN ('pending', 'paid')
    GROUP BY x.refill_order_id, x.purpose
    HAVING COUNT(*) > 1
  )
ORDER BY po.refill_order_id, po.purpose, po.status, po.created_at;

-- C) paid+paid 計數（必須為 0 才可執行會改寫狀態的 migration）
SELECT COUNT(*) AS paid_plus_paid_groups
FROM (
  SELECT refill_order_id, purpose
  FROM payment_orders
  WHERE status = 'paid'
  GROUP BY refill_order_id, purpose
  HAVING COUNT(*) > 1
) d;
