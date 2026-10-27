ALTER TABLE "purchase_receipts" ADD COLUMN "source_order_id" TEXT, ADD COLUMN "submission_key" TEXT, ADD COLUMN "submission_hash" TEXT;
ALTER TABLE "purchase_receipt_items" ADD COLUMN "source_order_item_id" TEXT;
CREATE UNIQUE INDEX "purchase_receipts_submission_key_key" ON "purchase_receipts"("submission_key");
CREATE INDEX "purchase_receipts_source_order_id_idx" ON "purchase_receipts"("source_order_id");
CREATE INDEX "purchase_receipt_items_source_order_item_id_idx" ON "purchase_receipt_items"("source_order_item_id");
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_source_order_item_id_fkey" FOREIGN KEY ("source_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
