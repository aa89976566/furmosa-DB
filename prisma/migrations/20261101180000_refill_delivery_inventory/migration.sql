ALTER TABLE "refill_orders"
  ADD COLUMN "delivered_flavour_id" TEXT,
  ADD COLUMN "delivered_quantity" INTEGER;

CREATE INDEX "refill_orders_delivered_flavour_id_idx"
  ON "refill_orders"("delivered_flavour_id");

ALTER TABLE "refill_orders"
  ADD CONSTRAINT "refill_orders_delivered_flavour_id_fkey"
  FOREIGN KEY ("delivered_flavour_id") REFERENCES "refill_flavours"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
