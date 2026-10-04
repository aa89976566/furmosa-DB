-- Chicken fillet treats are shelf-stable ambient products.
-- Only fill legacy rows that are still unset; preserve any explicit operator override.
UPDATE "Product"
SET "default_temperature" = 'ambient'::"ProductTemperature"
WHERE "sourceSku" IN ('CK-05', 'CK-06')
  AND "default_temperature" IS NULL;
