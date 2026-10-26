CREATE TABLE "purchase_receipt_metadata_changes" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "receipt_id" TEXT NOT NULL REFERENCES "purchase_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "actor_id" TEXT NOT NULL,
 "actor_name" TEXT NOT NULL,
 "before" JSONB NOT NULL,
 "after" JSONB NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "purchase_receipt_metadata_changes_receipt_id_created_at_idx" ON "purchase_receipt_metadata_changes"("receipt_id", "created_at");
