-- Unify LINE refill flavours with Product master (assortment → SKU link).
-- Product remains commerce SoT; RefillFlavour is period/marketing overlay.

ALTER TABLE "refill_flavours" ADD COLUMN IF NOT EXISTS "product_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "refill_flavours_product_id_key"
  ON "refill_flavours"("product_id");

DO $$ BEGIN
  ALTER TABLE "refill_flavours"
    ADD CONSTRAINT "refill_flavours_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "Product"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
