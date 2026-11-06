-- Allow a customer to open a fresh ECPay checkout after an abandoned or expired
-- attempt, while keeping exactly one successful payment per order and purpose.
-- Existing payment and audit rows are preserved.

DROP INDEX IF EXISTS "payment_orders_active_refill_purpose_key";

CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_paid_refill_purpose_key"
ON "payment_orders"("refill_order_id", "purpose")
WHERE "status" = 'paid';
