-- Additive only: old deployed code continues to work. No historical values inferred.
ALTER TABLE "restock_request_items" ADD COLUMN "weight_grams" INTEGER;
ALTER TABLE "restock_request_items" ADD COLUMN "variant_key" TEXT;
ALTER TABLE "ShipmentItem" ADD COLUMN "variantKey" TEXT;
ALTER TABLE "restock_request_items" ADD CONSTRAINT "restock_item_positive_weight" CHECK ("weight_grams" IS NULL OR "weight_grams" > 0);
