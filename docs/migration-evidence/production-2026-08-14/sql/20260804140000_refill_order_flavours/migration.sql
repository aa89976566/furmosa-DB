-- Preferred (soft) vs fulfilled (actual) flavours on refill orders.
-- Nullable for backward compatibility with existing paid/completed orders.

ALTER TABLE "refill_orders"
  ADD COLUMN IF NOT EXISTS "preferred_flavour_id" TEXT;

ALTER TABLE "refill_orders"
  ADD COLUMN IF NOT EXISTS "fulfilled_flavour_id" TEXT;

ALTER TABLE "refill_orders"
  ADD COLUMN IF NOT EXISTS "fulfilled_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "refill_orders_preferred_flavour_id_idx"
  ON "refill_orders"("preferred_flavour_id");

CREATE INDEX IF NOT EXISTS "refill_orders_fulfilled_flavour_id_idx"
  ON "refill_orders"("fulfilled_flavour_id");

-- One new jar serial may only bind to one refill order once fulfilled.
CREATE UNIQUE INDEX IF NOT EXISTS "refill_orders_new_container_serial_key"
  ON "refill_orders"("new_container_serial")
  WHERE "new_container_serial" IS NOT NULL;

DO $$ BEGIN
  ALTER TABLE "refill_orders"
    ADD CONSTRAINT "refill_orders_preferred_flavour_id_fkey"
    FOREIGN KEY ("preferred_flavour_id") REFERENCES "refill_flavours"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "refill_orders"
    ADD CONSTRAINT "refill_orders_fulfilled_flavour_id_fkey"
    FOREIGN KEY ("fulfilled_flavour_id") REFERENCES "refill_flavours"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
