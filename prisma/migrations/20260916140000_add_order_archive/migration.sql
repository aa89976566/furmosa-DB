ALTER TABLE "Order"
  ADD COLUMN "archived_at" TIMESTAMP(3),
  ADD COLUMN "archived_by_id" TEXT;

CREATE INDEX "Order_archived_at_idx" ON "Order"("archived_at");
CREATE INDEX "Order_archived_by_id_idx" ON "Order"("archived_by_id");

ALTER TABLE "Order"
  ADD CONSTRAINT "Order_archived_by_id_fkey"
  FOREIGN KEY ("archived_by_id") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
