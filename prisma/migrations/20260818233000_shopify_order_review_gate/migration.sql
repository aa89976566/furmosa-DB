ALTER TABLE "Order"
ADD COLUMN "external_store" TEXT,
ADD COLUMN "external_order_id" TEXT,
ADD COLUMN "external_order_name" TEXT;

CREATE UNIQUE INDEX "Order_external_store_external_order_id_key"
ON "Order"("external_store", "external_order_id");
