-- Additive only. Existing orders remain visible; no rows or external IDs removed.
ALTER TABLE "Order" ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by_id" TEXT,
  ADD COLUMN "deletion_reason" TEXT;
