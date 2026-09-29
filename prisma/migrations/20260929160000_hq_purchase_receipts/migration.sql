ALTER TABLE "Product" ADD COLUMN "average_cost_per_gram" DECIMAL(18,6);

CREATE TABLE "purchase_receipts" (
  "id" TEXT NOT NULL,
  "receipt_number" TEXT NOT NULL,
  "supplier_document_number" TEXT,
  "receipt_date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'posted',
  "vendor_id" TEXT,
  "warehouse_id" TEXT NOT NULL,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "shipping_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "packaging_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "processing_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(14,2) NOT NULL,
  "note" TEXT,
  "posted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_receipt_items" (
  "id" TEXT NOT NULL,
  "purchase_receipt_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "inventory_transaction_id" TEXT NOT NULL,
  "quantity_grams" INTEGER NOT NULL,
  "raw_amount" DECIMAL(14,2) NOT NULL,
  "allocated_cost" DECIMAL(14,2) NOT NULL,
  "landed_amount" DECIMAL(14,2) NOT NULL,
  "cost_per_gram" DECIMAL(18,6) NOT NULL,
  "previous_stock_grams" INTEGER NOT NULL,
  "resulting_stock_grams" INTEGER NOT NULL,
  "previous_average_cost_per_gram" DECIMAL(18,6) NOT NULL,
  "new_average_cost_per_gram" DECIMAL(18,6) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_receipt_attachments" (
  "id" TEXT NOT NULL,
  "purchase_receipt_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_receipt_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "purchase_receipts_receipt_number_key" ON "purchase_receipts"("receipt_number");
CREATE UNIQUE INDEX "purchase_receipts_vendor_id_supplier_document_number_key" ON "purchase_receipts"("vendor_id", "supplier_document_number");
CREATE INDEX "purchase_receipts_receipt_date_idx" ON "purchase_receipts"("receipt_date");
CREATE INDEX "purchase_receipts_vendor_id_receipt_date_idx" ON "purchase_receipts"("vendor_id", "receipt_date");
CREATE UNIQUE INDEX "purchase_receipt_items_inventory_transaction_id_key" ON "purchase_receipt_items"("inventory_transaction_id");
CREATE INDEX "purchase_receipt_items_purchase_receipt_id_idx" ON "purchase_receipt_items"("purchase_receipt_id");
CREATE INDEX "purchase_receipt_items_product_id_created_at_idx" ON "purchase_receipt_items"("product_id", "created_at");
CREATE INDEX "purchase_receipt_attachments_purchase_receipt_id_idx" ON "purchase_receipt_attachments"("purchase_receipt_id");

ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_receipt_id_fkey" FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_inventory_transaction_id_fkey" FOREIGN KEY ("inventory_transaction_id") REFERENCES "InventoryTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_attachments" ADD CONSTRAINT "purchase_receipt_attachments_purchase_receipt_id_fkey" FOREIGN KEY ("purchase_receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
