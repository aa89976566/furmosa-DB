-- POS 換罐交付帳本：新增式 migration，不移除既有欄位與資料。
ALTER TABLE "refill_orders"
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "fulfilled_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "refill_orders"
  ADD CONSTRAINT "refill_orders_quantity_check"
  CHECK ("quantity" > 0 AND "fulfilled_quantity" >= 0 AND "fulfilled_quantity" <= "quantity");

CREATE TABLE "refill_fulfillments" (
  "id" TEXT NOT NULL,
  "refill_order_id" TEXT NOT NULL,
  "merchant_id" TEXT NOT NULL,
  "operator_merchant_user_id" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "pickup_quantity" INTEGER NOT NULL,
  "returned_quantity" INTEGER NOT NULL,
  "exchange_quantity" INTEGER NOT NULL,
  "original_price_quantity" INTEGER NOT NULL,
  "extra_return_quantity" INTEGER NOT NULL,
  "exchange_unit_price" INTEGER NOT NULL DEFAULT 99,
  "original_unit_price" INTEGER NOT NULL DEFAULT 129,
  "final_amount" INTEGER NOT NULL,
  "prepaid_amount" INTEGER NOT NULL,
  "top_up_amount" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refill_fulfillments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refill_fulfillments_quantity_check" CHECK (
    "pickup_quantity" > 0 AND
    "returned_quantity" >= 0 AND
    "exchange_quantity" >= 0 AND
    "original_price_quantity" >= 0 AND
    "extra_return_quantity" >= 0 AND
    "exchange_quantity" + "original_price_quantity" = "pickup_quantity"
  ),
  CONSTRAINT "refill_fulfillments_amount_check" CHECK (
    "exchange_unit_price" >= 0 AND
    "original_unit_price" >= 0 AND
    "final_amount" >= 0 AND
    "prepaid_amount" >= 0 AND
    "top_up_amount" >= 0
  )
);

CREATE UNIQUE INDEX "refill_fulfillments_idempotency_key_key"
  ON "refill_fulfillments"("idempotency_key");
CREATE INDEX "refill_fulfillments_refill_order_id_created_at_idx"
  ON "refill_fulfillments"("refill_order_id", "created_at");
CREATE INDEX "refill_fulfillments_merchant_id_completed_at_idx"
  ON "refill_fulfillments"("merchant_id", "completed_at");
CREATE INDEX "refill_fulfillments_operator_merchant_user_id_completed_at_idx"
  ON "refill_fulfillments"("operator_merchant_user_id", "completed_at");

CREATE TABLE "refill_fulfillment_jars" (
  "id" TEXT NOT NULL,
  "fulfillment_id" TEXT NOT NULL,
  "jar_code_id" TEXT,
  "role" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "serial" TEXT,
  "status" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refill_fulfillment_jars_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refill_fulfillment_jars_role_check" CHECK ("role" IN ('returned_old', 'issued_new')),
  CONSTRAINT "refill_fulfillment_jars_status_check" CHECK ("status" IN ('accepted', 'pending_line_registration', 'registered')),
  CONSTRAINT "refill_fulfillment_jars_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "refill_fulfillment_jars_return_serial_check" CHECK (
    "role" <> 'returned_old' OR ("serial" IS NOT NULL AND "jar_code_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "refill_fulfillment_jars_fulfillment_id_role_sequence_key"
  ON "refill_fulfillment_jars"("fulfillment_id", "role", "sequence");
CREATE UNIQUE INDEX "refill_fulfillment_jars_fulfillment_id_serial_key"
  ON "refill_fulfillment_jars"("fulfillment_id", "serial");
CREATE INDEX "refill_fulfillment_jars_jar_code_id_idx"
  ON "refill_fulfillment_jars"("jar_code_id");
CREATE INDEX "refill_fulfillment_jars_status_created_at_idx"
  ON "refill_fulfillment_jars"("status", "created_at");

ALTER TABLE "MerchantStockTxn" ADD COLUMN "refill_fulfillment_id" TEXT;
CREATE INDEX "MerchantStockTxn_refill_fulfillment_id_idx"
  ON "MerchantStockTxn"("refill_fulfillment_id");

ALTER TABLE "refill_fulfillments"
  ADD CONSTRAINT "refill_fulfillments_refill_order_id_fkey"
  FOREIGN KEY ("refill_order_id") REFERENCES "refill_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refill_fulfillments"
  ADD CONSTRAINT "refill_fulfillments_merchant_id_fkey"
  FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refill_fulfillments"
  ADD CONSTRAINT "refill_fulfillments_operator_merchant_user_id_fkey"
  FOREIGN KEY ("operator_merchant_user_id") REFERENCES "merchant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refill_fulfillment_jars"
  ADD CONSTRAINT "refill_fulfillment_jars_fulfillment_id_fkey"
  FOREIGN KEY ("fulfillment_id") REFERENCES "refill_fulfillments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refill_fulfillment_jars"
  ADD CONSTRAINT "refill_fulfillment_jars_jar_code_id_fkey"
  FOREIGN KEY ("jar_code_id") REFERENCES "jar_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MerchantStockTxn"
  ADD CONSTRAINT "MerchantStockTxn_refill_fulfillment_id_fkey"
  FOREIGN KEY ("refill_fulfillment_id") REFERENCES "refill_fulfillments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
