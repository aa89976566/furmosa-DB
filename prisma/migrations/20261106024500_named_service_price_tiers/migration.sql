-- Allow named service plans to share the same billing unit (for example, six distinct 1 次 consultations).
ALTER TABLE "ProductPriceTier"
  ADD COLUMN "variant_name" TEXT,
  ADD COLUMN "variant_key" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "ProductPriceTier_productId_weightGrams_unit_unitQty_key";

CREATE UNIQUE INDEX "ProductPriceTier_productId_weightGrams_unit_unitQty_variant_key_key"
  ON "ProductPriceTier"("productId", "weightGrams", "unit", "unitQty", "variant_key");
