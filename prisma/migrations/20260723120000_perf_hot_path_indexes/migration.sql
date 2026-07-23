-- Hot-path indexes for HQ list/dashboard/portfolio queries
CREATE INDEX IF NOT EXISTS "Customer_lastOrderAt_idx" ON "Customer"("lastOrderAt");
CREATE INDEX IF NOT EXISTS "Customer_name_idx" ON "Customer"("name");
CREATE INDEX IF NOT EXISTS "Customer_phone_idx" ON "Customer"("phone");

CREATE INDEX IF NOT EXISTS "Product_status_idx" ON "Product"("status");
CREATE INDEX IF NOT EXISTS "Product_name_idx" ON "Product"("name");

CREATE INDEX IF NOT EXISTS "Shipment_orderId_idx" ON "Shipment"("orderId");
CREATE INDEX IF NOT EXISTS "Shipment_status_createdAt_idx" ON "Shipment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Shipment_type_status_idx" ON "Shipment"("type", "status");

CREATE INDEX IF NOT EXISTS "MerchantStockTxn_type_createdAt_idx" ON "MerchantStockTxn"("type", "createdAt");
CREATE INDEX IF NOT EXISTS "MerchantStockTxn_merchantId_type_createdAt_idx" ON "MerchantStockTxn"("merchantId", "type", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX IF NOT EXISTS "Order_merchantId_idx" ON "Order"("merchantId");
CREATE INDEX IF NOT EXISTS "Order_status_orderedAt_idx" ON "Order"("status", "orderedAt");
CREATE INDEX IF NOT EXISTS "Order_source_orderedAt_idx" ON "Order"("source", "orderedAt");
