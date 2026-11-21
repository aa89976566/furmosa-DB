-- Run as a separately approved catalog change after the refill recipe release.
-- Adds only the two recipe rows. It never creates balances or changes existing stock.
DO $recipe$
DECLARE
  duck_id TEXT;
  jar_tier_id TEXT;
  throat_id TEXT;
  lung_id TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));

  SELECT id INTO STRICT duck_id FROM "Product"
    WHERE sku='RF-CRISPY-DUCK' AND product_category='JAR_EXCHANGE'
      AND status='active' AND inventory_source_product_id IS NULL
    FOR UPDATE;

  SELECT id INTO STRICT jar_tier_id FROM "ProductPriceTier"
    WHERE "productId"=duck_id AND tier_sku='RF-CRISPY-DUCK-1JAR'
      AND status='active' AND inventory_policy='shared'
      AND unit='罐' AND "unitQty"=1 AND "weightGrams" IS NULL
    FOR UPDATE;

  SELECT id INTO STRICT throat_id FROM "Product"
    WHERE sku='FUR-0008' AND product_category='STANDARD' AND status='active'
      AND hq_bulk_unit(unit)='g' AND inventory_source_product_id IS NULL;
  SELECT id INTO STRICT lung_id FROM "Product"
    WHERE sku='FUR-0005' AND product_category='STANDARD' AND status='active'
      AND hq_bulk_unit(unit)='g' AND inventory_source_product_id IS NULL;

  IF EXISTS (
    SELECT 1 FROM "ProductPriceTier" t JOIN "ProductBundleComponent" c ON c."tierId"=t.id
    WHERE t."productId" IN (throat_id,lung_id)
  ) THEN
    RAISE EXCEPTION '鴨喉或鴨肺已使用其他組合配方';
  END IF;

  IF (
    SELECT count(DISTINCT b."productId")
    FROM "InventoryBalance" b JOIN "Warehouse" w ON w.id=b."warehouseId"
    WHERE b."productId" IN (throat_id,lung_id) AND b.unit='g' AND w.code='WH-MAIN'
  ) <> 2 THEN
    RAISE EXCEPTION '鴨喉與鴨肺都必須有主倉克數庫存來源';
  END IF;

  IF EXISTS (SELECT 1 FROM "ProductBundleComponent" WHERE "tierId"=jar_tier_id) THEN
    IF (
      SELECT count(*) FROM "ProductBundleComponent"
      WHERE "tierId"=jar_tier_id AND ("componentProductId","gramsPerPack")
        IN ((throat_id,12),(lung_id,15))
    ) <> 2 OR (SELECT count(*) FROM "ProductBundleComponent" WHERE "tierId"=jar_tier_id) <> 2 THEN
      RAISE EXCEPTION '脆脆鴨已有不同配方，請核對後再操作';
    END IF;
    RETURN;
  END IF;

  INSERT INTO "ProductBundleComponent" ("tierId","componentProductId","gramsPerPack")
    VALUES (jar_tier_id,throat_id,12),(jar_tier_id,lung_id,15);
END
$recipe$;
