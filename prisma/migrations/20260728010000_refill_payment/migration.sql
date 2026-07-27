-- Stage 5: RefillOrder / PaymentOrder / audit + JarCode lifecycle for LIFF refill payment

-- JarCode: issued / returned lifecycle (legacy unused→used redeem kept)
ALTER TABLE "jar_codes" ADD COLUMN IF NOT EXISTS "issued_at" TIMESTAMP(3);
ALTER TABLE "jar_codes" ADD COLUMN IF NOT EXISTS "returned_at" TIMESTAMP(3);
ALTER TABLE "jar_codes" ADD COLUMN IF NOT EXISTS "issued_merchant_id" TEXT;
ALTER TABLE "jar_codes" ADD COLUMN IF NOT EXISTS "returned_merchant_id" TEXT;
ALTER TABLE "jar_codes" ADD COLUMN IF NOT EXISTS "locked_by_refill_order_id" TEXT;

CREATE INDEX IF NOT EXISTS "jar_codes_locked_by_refill_order_id_idx" ON "jar_codes"("locked_by_refill_order_id");

CREATE INDEX IF NOT EXISTS "Customer_lineUserId_idx" ON "Customer"("lineUserId");

CREATE INDEX IF NOT EXISTS "member_points_ledger_source_type_source_ref_id_idx"
  ON "member_points_ledger"("source_type", "source_ref_id");

-- Refill orders
CREATE TABLE IF NOT EXISTS "refill_orders" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "pet_name" TEXT,
    "product_id" TEXT,
    "order_type" TEXT NOT NULL,
    "base_amount" INTEGER NOT NULL,
    "extra_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "delivery_mode" TEXT NOT NULL DEFAULT 'exchange',
    "old_container_serial" TEXT,
    "new_container_serial" TEXT,
    "missing_container_note" TEXT,
    "paid_at" TIMESTAMP(3),
    "old_container_returned_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "points_awarded_at" TIMESTAMP(3),
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refill_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "refill_orders_idempotency_key_key" ON "refill_orders"("idempotency_key");
CREATE INDEX IF NOT EXISTS "refill_orders_customer_id_status_idx" ON "refill_orders"("customer_id", "status");
CREATE INDEX IF NOT EXISTS "refill_orders_merchant_id_status_idx" ON "refill_orders"("merchant_id", "status");
CREATE INDEX IF NOT EXISTS "refill_orders_appointment_id_idx" ON "refill_orders"("appointment_id");
CREATE INDEX IF NOT EXISTS "refill_orders_status_created_at_idx" ON "refill_orders"("status", "created_at");

-- Payment orders (ECPay)
CREATE TABLE IF NOT EXISTS "payment_orders" (
    "id" TEXT NOT NULL,
    "refill_order_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ecpay',
    "merchant_trade_no" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "provider_trade_no" TEXT,
    "paid_at" TIMESTAMP(3),
    "callback_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_orders_merchant_trade_no_key" ON "payment_orders"("merchant_trade_no");
CREATE INDEX IF NOT EXISTS "payment_orders_refill_order_id_purpose_idx" ON "payment_orders"("refill_order_id", "purpose");
CREATE INDEX IF NOT EXISTS "payment_orders_status_idx" ON "payment_orders"("status");

-- Audit
CREATE TABLE IF NOT EXISTS "refill_audit_logs" (
    "id" TEXT NOT NULL,
    "refill_order_id" TEXT,
    "payment_order_id" TEXT,
    "action" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "merchant_id" TEXT,
    "serial" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refill_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "refill_audit_logs_refill_order_id_created_at_idx" ON "refill_audit_logs"("refill_order_id", "created_at");
CREATE INDEX IF NOT EXISTS "refill_audit_logs_payment_order_id_idx" ON "refill_audit_logs"("payment_order_id");
CREATE INDEX IF NOT EXISTS "refill_audit_logs_action_created_at_idx" ON "refill_audit_logs"("action", "created_at");

-- FKs (JarCode lock FK after refill_orders exists)
DO $$ BEGIN
  ALTER TABLE "jar_codes" ADD CONSTRAINT "jar_codes_issued_merchant_id_fkey"
    FOREIGN KEY ("issued_merchant_id") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "jar_codes" ADD CONSTRAINT "jar_codes_returned_merchant_id_fkey"
    FOREIGN KEY ("returned_merchant_id") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "jar_codes" ADD CONSTRAINT "jar_codes_locked_by_refill_order_id_fkey"
    FOREIGN KEY ("locked_by_refill_order_id") REFERENCES "refill_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "refill_orders" ADD CONSTRAINT "refill_orders_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "refill_orders" ADD CONSTRAINT "refill_orders_appointment_id_fkey"
    FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "refill_orders" ADD CONSTRAINT "refill_orders_merchant_id_fkey"
    FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "refill_orders" ADD CONSTRAINT "refill_orders_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_refill_order_id_fkey"
    FOREIGN KEY ("refill_order_id") REFERENCES "refill_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "refill_audit_logs" ADD CONSTRAINT "refill_audit_logs_refill_order_id_fkey"
    FOREIGN KEY ("refill_order_id") REFERENCES "refill_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "refill_audit_logs" ADD CONSTRAINT "refill_audit_logs_payment_order_id_fkey"
    FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
