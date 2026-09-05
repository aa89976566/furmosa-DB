-- Manual rollback for 20260904110000_shipment_received_fields.
-- Drop CHECK / FK / index first, then columns. Does not rewrite business data.

ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_received_requires_merchant_restock_check";

ALTER TABLE "MerchantStockTxn" DROP CONSTRAINT "MerchantStockTxn_shipmentItemId_fkey";
ALTER TABLE "Shipment" DROP CONSTRAINT "Shipment_receivedByMerchantUserId_fkey";

DROP INDEX "MerchantStockTxn_shipmentItemId_key";
DROP INDEX "Shipment_receivedByMerchantUserId_idx";

ALTER TABLE "MerchantStockTxn" DROP COLUMN "shipmentItemId";
ALTER TABLE "Shipment" DROP COLUMN "receivedAt";
ALTER TABLE "Shipment" DROP COLUMN "receivedByMerchantUserId";
