
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
DO $$
DECLARE
 p CONSTANT TEXT := '809871bc-c7b9-448a-8c27-73cb8e801fd0';
 r RECORD;
 wh TEXT;
 ev TEXT;
 enabled_at TIMESTAMP := clock_timestamp();
 done_count INTEGER;
BEGIN
 SELECT id INTO wh FROM "Warehouse" WHERE code='WH-MAIN';
 IF wh IS NULL THEN RAISE EXCEPTION 'WH-MAIN 不存在'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "Product" WHERE id=p AND sku='BUNDLE-WAX-2026' AND cost=230 AND unit='組')
 THEN RAISE EXCEPTION '聯名組身份或成本與核准設定不符'; END IF;
 IF NOT EXISTS(SELECT 1 FROM "ProductPriceTier" WHERE id='cmpo2s6r6001hoseb1o5evkd8'
 AND "productId"='cmp2idsu60006qw9lwk1thk62' AND "weightGrams"=50 AND cost=40)
 THEN RAISE EXCEPTION '既有雞霸成品身份或成本已改變'; END IF;
 IF (SELECT count(*) FROM "ProductPriceTier" WHERE "productId"=p)<>4
 THEN RAISE EXCEPTION '聯名組必須恰有四款香氣'; END IF;
 FOR r IN SELECT * FROM (VALUES
 ('BUNDLE-WAX-2026-01','65200876290425','牡丹'),
 ('BUNDLE-WAX-2026-02','65200876323193','杜桑'),
 ('BUNDLE-WAX-2026-03','65200876355961','經典迪奧'),
 ('BUNDLE-WAX-2026-04','65200876388729','琥珀與薰衣草')
 ) AS expected(sku,variant_id,name)
 LOOP
 IF NOT EXISTS(SELECT 1 FROM "ProductPriceTier" WHERE "productId"=p AND shopify_sku=r.sku
 AND shopify_variant_id=r.variant_id AND variant_name=r.name AND cost=230 AND price=399
 AND unit='組' AND "unitQty"=1 AND "weightGrams" IS NULL AND status='active')
 THEN RAISE EXCEPTION '香氣規格對應與核准設定不符：%',r.name; END IF;
 END LOOP;
 SELECT count(*) INTO done_count FROM "ProductVariantInventoryTransaction" x
 JOIN "ProductPriceTier" t ON t.id=x."tierId"
 WHERE t."productId"=p AND x.reference='opening:collab-wax-20261111' AND x.type='opening';
 IF done_count=4 THEN RETURN; END IF;
 IF done_count<>0 OR EXISTS(SELECT 1 FROM "ProductVariantInventoryBalance" b
 JOIN "ProductPriceTier" t ON t.id=b."tierId" WHERE t."productId"=p)
 OR EXISTS(SELECT 1 FROM "InventoryBalance" WHERE "productId"=p AND quantity<>0)
 THEN RAISE EXCEPTION '已有庫存紀錄，停止覆寫；請人工核對'; END IF;
 UPDATE "ProductPriceTier" SET inventory_policy='variant',inventory_unit='顆',inventory_enabled_at=enabled_at
 WHERE "productId"=p;
 FOR r IN SELECT id,variant_name,shopify_variant_id FROM "ProductPriceTier" WHERE "productId"=p ORDER BY id LOOP
 ev:='opening:collab-wax-20261111:'||r.id;
 INSERT INTO "ProductVariantInventoryBalance"("tierId","warehouseId",quantity,unit) VALUES(r.id,wh,20,'顆');
 INSERT INTO "ProductVariantInventoryTransaction"(id,"eventKey","tierId","warehouseId",quantity,unit,type,reference,"sourceSnapshot")
 VALUES('hvi-'||md5(ev),ev,r.id,wh,20,'顆','opening','opening:collab-wax-20261111',
 jsonb_build_object('source','user-authorized-opening','physicalCountVerified',false,
 'variantName',r.variant_name,'shopifyVariantId',r.shopify_variant_id,'quantity',20,'candleCost',190,
 'chickenProductId','cmp2idsu60006qw9lwk1thk62','chickenTierId','cmpo2s6r6001hoseb1o5evkd8',
 'chickenCost',40,'chickenQuantity',1,'chickenStockPolicy','made-to-order-no-deduction',
 'bundleUnitCost',230,'bundleUnit','組','candleQuantityPerBundle',1,'enabledAt',enabled_at));
 END LOOP;
END $$;
COMMIT;

