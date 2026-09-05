-- Additive-only: merchant_restock receipt audit fields.
-- No backfill. Does not rewrite delivered → received. Does not change status type.

-- 1. Columns
ALTER TABLE "Shipment" ADD COLUMN "receivedAt" TIMESTAMP(3);
ALTER TABLE "Shipment" ADD COLUMN "receivedByMerchantUserId" TEXT;

ALTER TABLE "MerchantStockTxn" ADD COLUMN "shipmentItemId" TEXT;

-- 2. Unique / index
-- PostgreSQL unique index allows multiple NULLs; each non-NULL ShipmentItem may be referenced once.
CREATE UNIQUE INDEX "MerchantStockTxn_shipmentItemId_key" ON "MerchantStockTxn"("shipmentItemId");

CREATE INDEX "Shipment_receivedByMerchantUserId_idx" ON "Shipment"("receivedByMerchantUserId");

-- 3. Foreign keys
ALTER TABLE "Shipment"
ADD CONSTRAINT "Shipment_receivedByMerchantUserId_fkey"
FOREIGN KEY ("receivedByMerchantUserId") REFERENCES "merchant_users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MerchantStockTxn"
ADD CONSTRAINT "MerchantStockTxn_shipmentItemId_fkey"
FOREIGN KEY ("shipmentItemId") REFERENCES "ShipmentItem"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Table CHECK (NOT VALID: do not scan existing rows)
ALTER TABLE "Shipment"
ADD CONSTRAINT "Shipment_received_requires_merchant_restock_check"
CHECK ("status" <> 'received' OR "type" = 'merchant_restock') NOT VALID;
