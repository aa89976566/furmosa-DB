-- Phase 1: additive only — NT$99 換購資格表
-- 不 ALTER refill_orders；不改 old_container_returned_at 語意；不 backfill。

CREATE TABLE "refill_exchange_entitlements" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "returned_jar_code_id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "activated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "redeemed_at" TIMESTAMP(3),
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refill_exchange_entitlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refill_exchange_entitlements_returned_jar_code_id_key"
  ON "refill_exchange_entitlements"("returned_jar_code_id");

CREATE INDEX "refill_exchange_entitlements_customer_id_expires_at_idx"
  ON "refill_exchange_entitlements"("customer_id", "expires_at");

CREATE INDEX "refill_exchange_entitlements_merchant_id_expires_at_idx"
  ON "refill_exchange_entitlements"("merchant_id", "expires_at");

CREATE INDEX "refill_exchange_entitlements_expires_at_reminder_sent_at_idx"
  ON "refill_exchange_entitlements"("expires_at", "reminder_sent_at");

-- Restrict：資格審計不可因刪除會員／序號／店家而靜默消失
ALTER TABLE "refill_exchange_entitlements"
  ADD CONSTRAINT "refill_exchange_entitlements_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "Customer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refill_exchange_entitlements"
  ADD CONSTRAINT "refill_exchange_entitlements_returned_jar_code_id_fkey"
  FOREIGN KEY ("returned_jar_code_id") REFERENCES "jar_codes"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "refill_exchange_entitlements"
  ADD CONSTRAINT "refill_exchange_entitlements_merchant_id_fkey"
  FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
