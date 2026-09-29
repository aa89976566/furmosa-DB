CREATE TABLE "purchase_orders" (
  "id" TEXT NOT NULL,
  "order_number" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending_receipt',
  "vendor_id" TEXT,
  "warehouse_id" TEXT NOT NULL,
  "supplier_document_number" TEXT,
  "remind_from_date" TIMESTAMP(3) NOT NULL,
  "subtotal" DECIMAL(14,2) NOT NULL,
  "shipping_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "packaging_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "processing_cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(14,2) NOT NULL,
  "note" TEXT,
  "created_by_id" TEXT NOT NULL,
  "received_by_id" TEXT,
  "received_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "cancel_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_items" (
  "id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "line_number" INTEGER NOT NULL,
  "product_id" TEXT NOT NULL,
  "product_name" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'g',
  "quantity_grams" INTEGER NOT NULL,
  "raw_amount" DECIMAL(14,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_attachments" (
  "id" TEXT NOT NULL,
  "purchase_order_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stocktake_adjustments" (
  "id" TEXT NOT NULL,
  "event_key" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "warehouse_id" TEXT NOT NULL,
  "inventory_transaction_id" TEXT NOT NULL,
  "before_quantity" INTEGER NOT NULL,
  "after_quantity" INTEGER NOT NULL,
  "delta_quantity" INTEGER NOT NULL,
  "before_total_cost" DECIMAL(14,2) NOT NULL,
  "after_total_cost" DECIMAL(14,2) NOT NULL,
  "delta_total_cost" DECIMAL(14,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "reversal_of_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stocktake_adjustments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "purchase_receipts" ADD COLUMN "purchase_order_id" TEXT;

CREATE UNIQUE INDEX "purchase_orders_order_number_key" ON "purchase_orders"("order_number");
CREATE UNIQUE INDEX "purchase_orders_vendor_id_supplier_document_number_key" ON "purchase_orders"("vendor_id", "supplier_document_number");
CREATE INDEX "purchase_orders_status_remind_from_date_idx" ON "purchase_orders"("status", "remind_from_date");
CREATE INDEX "purchase_orders_created_at_idx" ON "purchase_orders"("created_at");
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_line_number_key" ON "purchase_order_items"("purchase_order_id", "line_number");
CREATE UNIQUE INDEX "purchase_order_items_purchase_order_id_product_id_key" ON "purchase_order_items"("purchase_order_id", "product_id");
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");
CREATE INDEX "purchase_order_attachments_purchase_order_id_idx" ON "purchase_order_attachments"("purchase_order_id");
CREATE UNIQUE INDEX "stocktake_adjustments_event_key_key" ON "stocktake_adjustments"("event_key");
CREATE UNIQUE INDEX "stocktake_adjustments_inventory_transaction_id_key" ON "stocktake_adjustments"("inventory_transaction_id");
CREATE UNIQUE INDEX "stocktake_adjustments_reversal_of_id_key" ON "stocktake_adjustments"("reversal_of_id");
CREATE INDEX "stocktake_adjustments_product_id_warehouse_id_created_at_idx" ON "stocktake_adjustments"("product_id", "warehouse_id", "created_at");
CREATE UNIQUE INDEX "purchase_receipts_purchase_order_id_key" ON "purchase_receipts"("purchase_order_id");

ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_attachments" ADD CONSTRAINT "purchase_order_attachments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stocktake_adjustments" ADD CONSTRAINT "stocktake_adjustments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stocktake_adjustments" ADD CONSTRAINT "stocktake_adjustments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stocktake_adjustments" ADD CONSTRAINT "stocktake_adjustments_inventory_transaction_id_fkey" FOREIGN KEY ("inventory_transaction_id") REFERENCES "InventoryTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stocktake_adjustments" ADD CONSTRAINT "stocktake_adjustments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stocktake_adjustments" ADD CONSTRAINT "stocktake_adjustments_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "stocktake_adjustments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
