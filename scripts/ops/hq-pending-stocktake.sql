SELECT p.id,p.sku,p."sourceSku",p.name,p.product_category,p.unit AS master_unit,
 (SELECT string_agg(CASE WHEN t."weightGrams" IS NOT NULL THEN t."weightGrams"::TEXT||'g' ELSE t."unitQty"::TEXT||t.unit END, ' / ' ORDER BY t."weightGrams",t."unitQty") FROM "ProductPriceTier" t WHERE t."productId"=p.id) AS sale_specs,
 b.quantity AS current_system_number,b.unit AS confirmed_inventory_unit,b."lastCountedAt"
 FROM "Product" p LEFT JOIN "Warehouse" w ON w.code='WH-MAIN' LEFT JOIN "InventoryBalance" b ON b."productId"=p.id AND b."warehouseId"=w.id
 WHERE p.status='active' AND p.category IN ('staple_food','treats','freeze_dried','health') AND (b."lastCountedAt" IS NULL OR b."lastCountedAt" < '2026-09-15') ORDER BY p.sku;
