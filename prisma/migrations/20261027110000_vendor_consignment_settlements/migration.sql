-- Supplier consignment is separate from merchant commission.
-- Existing vendors and orders remain unenrolled; no data is backfilled.
ALTER TABLE "Vendor"
  ADD COLUMN "supplier_consignment_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "furmosa_share_bps" INTEGER,
  ADD COLUMN "settlement_currency" TEXT NOT NULL DEFAULT 'TWD';

ALTER TABLE "OrderItem"
  ADD COLUMN "supplier_vendor_id_snapshot" TEXT,
  ADD COLUMN "supplier_furmosa_share_bps_snapshot" INTEGER;

ALTER TABLE "Vendor"
  ADD CONSTRAINT "Vendor_furmosa_share_bps_check"
  CHECK ("furmosa_share_bps" IS NULL OR ("furmosa_share_bps" >= 0 AND "furmosa_share_bps" <= 10000));

ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_supplier_furmosa_share_bps_snapshot_check"
  CHECK (
    "supplier_furmosa_share_bps_snapshot" IS NULL
    OR ("supplier_furmosa_share_bps_snapshot" >= 0 AND "supplier_furmosa_share_bps_snapshot" <= 10000)
  );

CREATE TABLE "vendor_settlements" (
  "id" TEXT NOT NULL,
  "settlement_number" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "period_start" TIMESTAMP(3) NOT NULL,
  "period_end" TIMESTAMP(3) NOT NULL,
  "gross_collected_twd" INTEGER NOT NULL,
  "refund_twd" INTEGER NOT NULL DEFAULT 0,
  "furmosa_share_twd" INTEGER NOT NULL,
  "vendor_payable_twd" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "rules_version" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "paid_at" TIMESTAMP(3),
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "vendor_settlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vendor_settlements_amounts_check" CHECK (
    "gross_collected_twd" >= 0
    AND "refund_twd" >= 0
    AND "refund_twd" <= "gross_collected_twd"
    AND "furmosa_share_twd" >= 0
    AND "vendor_payable_twd" >= 0
    AND "furmosa_share_twd" + "vendor_payable_twd" = "gross_collected_twd" - "refund_twd"
  ),
  CONSTRAINT "vendor_settlements_period_check" CHECK ("period_end" >= "period_start")
);

CREATE TABLE "vendor_settlement_items" (
  "id" TEXT NOT NULL,
  "vendor_settlement_id" TEXT NOT NULL,
  "order_item_id" TEXT,
  "source_kind" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "gross_collected_twd" INTEGER NOT NULL,
  "refund_twd" INTEGER NOT NULL DEFAULT 0,
  "furmosa_share_bps" INTEGER NOT NULL,
  "furmosa_share_twd" INTEGER NOT NULL,
  "vendor_payable_twd" INTEGER NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "source_snapshot" JSONB NOT NULL,
  "rules_version" TEXT NOT NULL,
  "voided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendor_settlement_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "vendor_settlement_items_amounts_check" CHECK (
    "gross_collected_twd" >= 0
    AND "refund_twd" >= 0
    AND "refund_twd" <= "gross_collected_twd"
    AND "furmosa_share_bps" >= 0
    AND "furmosa_share_bps" <= 10000
    AND "furmosa_share_twd" >= 0
    AND "vendor_payable_twd" >= 0
    AND "furmosa_share_twd" + "vendor_payable_twd" = "gross_collected_twd" - "refund_twd"
  )
);

CREATE UNIQUE INDEX "vendor_settlements_settlement_number_key" ON "vendor_settlements"("settlement_number");
CREATE UNIQUE INDEX "vendor_settlements_idempotency_key_key" ON "vendor_settlements"("idempotency_key");
CREATE INDEX "vendor_settlements_vendor_id_period_start_period_end_idx" ON "vendor_settlements"("vendor_id", "period_start", "period_end");
CREATE INDEX "vendor_settlements_status_idx" ON "vendor_settlements"("status");
CREATE INDEX "vendor_settlement_items_vendor_settlement_id_idx" ON "vendor_settlement_items"("vendor_settlement_id");
CREATE INDEX "vendor_settlement_items_order_item_id_idx" ON "vendor_settlement_items"("order_item_id");
CREATE INDEX "vendor_settlement_items_source_key_idx" ON "vendor_settlement_items"("source_key");

-- One active recognition per canonical source. Voided audit rows remain reusable.
CREATE UNIQUE INDEX "vendor_settlement_items_active_source_key_key"
  ON "vendor_settlement_items"("source_key")
  WHERE "voided_at" IS NULL;

ALTER TABLE "vendor_settlements"
  ADD CONSTRAINT "vendor_settlements_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_settlement_items"
  ADD CONSTRAINT "vendor_settlement_items_vendor_settlement_id_fkey"
  FOREIGN KEY ("vendor_settlement_id") REFERENCES "vendor_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "vendor_settlement_items"
  ADD CONSTRAINT "vendor_settlement_items_order_item_id_fkey"
  FOREIGN KEY ("order_item_id") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
