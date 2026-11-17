-- Optional alias only: existing pools, balances and immutable ledgers remain untouched.
ALTER TABLE "ProductPriceTier" ADD COLUMN "inventory_source_tier_id" TEXT;
ALTER TABLE "ProductPriceTier" ADD CONSTRAINT "tier_inventory_source_fk"
 FOREIGN KEY ("inventory_source_tier_id") REFERENCES "ProductPriceTier"(id) ON DELETE RESTRICT;
CREATE INDEX "tier_inventory_source_idx" ON "ProductPriceTier"("inventory_source_tier_id");
ALTER TABLE "ProductPriceTier" ADD CONSTRAINT "tier_inventory_source_not_self"
 CHECK (inventory_source_tier_id IS NULL OR inventory_source_tier_id<>id);

CREATE FUNCTION hq_variant_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE src RECORD;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
 IF NEW.inventory_source_tier_id IS NOT NULL THEN
  SELECT * INTO src FROM "ProductPriceTier" WHERE id=NEW.inventory_source_tier_id;
  IF NOT FOUND OR src.inventory_source_tier_id IS NOT NULL OR src.inventory_policy<>'variant'
   OR NEW.inventory_policy<>'variant' OR src.inventory_unit IS DISTINCT FROM NEW.inventory_unit
   OR EXISTS(SELECT 1 FROM "ProductPriceTier" WHERE inventory_source_tier_id=NEW.id)
   OR EXISTS(SELECT 1 FROM "ProductVariantInventoryBalance" WHERE "tierId"=NEW.id)
   OR EXISTS(SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE "tierId"=NEW.id)
   OR EXISTS(SELECT 1 FROM "ProductBundleComponent" WHERE "tierId"=NEW.id)
  THEN RAISE EXCEPTION '共用庫存必須連到同單位的獨立香氣庫存，且不得串接或持有獨立帳冊'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM "ProductPriceTier" WHERE inventory_source_tier_id=NEW.id
   AND (NEW.inventory_policy<>'variant' OR inventory_unit IS DISTINCT FROM NEW.inventory_unit))
 THEN RAISE EXCEPTION '此香氣庫存已有共用商品，不可改變來源政策或單位'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER variant_stock_source_guard BEFORE INSERT OR UPDATE ON "ProductPriceTier"
 FOR EACH ROW EXECUTE FUNCTION hq_variant_source_guard();
CREATE FUNCTION hq_variant_balance_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
 IF EXISTS(SELECT 1 FROM "ProductPriceTier" WHERE id=NEW."tierId" AND inventory_source_tier_id IS NOT NULL)
 THEN RAISE EXCEPTION '共用香氣商品不可另建獨立庫存，請使用來源庫存'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER variant_balance_source_guard BEFORE INSERT OR UPDATE ON "ProductVariantInventoryBalance"
 FOR EACH ROW EXECUTE FUNCTION hq_variant_balance_source_guard();
REVOKE ALL ON FUNCTION hq_variant_source_guard(),hq_variant_balance_source_guard() FROM PUBLIC;

CREATE OR REPLACE FUNCTION hq_variant_post(p_source TEXT,p_id TEXT,p_reverse BOOLEAN) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 src TEXT := p_source||':'||p_id;
 wh TEXT;
 l RECORD;
 t RECORD;
 b RECORD;
 r RECORD;
 ev TEXT;
 stock_id TEXT;
 stock_t RECORD;
BEGIN
 IF p_source NOT IN ('order','shipment') OR p_id IS NULL THEN RAISE EXCEPTION '無效的規格庫存來源'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
 SELECT id INTO wh FROM "Warehouse" WHERE code='WH-MAIN';
 IF wh IS NULL THEN RAISE EXCEPTION 'HQ 主倉 WH-MAIN 不存在'; END IF;
 IF p_reverse THEN
  FOR r IN SELECT * FROM "ProductVariantInventoryTransaction" WHERE reference=src AND type='sales_out' ORDER BY "tierId" LOOP
   IF NOT EXISTS(SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE "reversesId"=r.id) THEN
    UPDATE "ProductVariantInventoryBalance" SET quantity=quantity-r.quantity,"updatedAt"=now()
     WHERE "tierId"=r."tierId" AND "warehouseId"=r."warehouseId" AND unit=r.unit;
    IF NOT FOUND THEN RAISE EXCEPTION '規格回補單位不一致'; END IF;
    INSERT INTO "ProductVariantInventoryTransaction"
    (id,"eventKey","tierId","warehouseId",quantity,unit,type,reference,"sourceSnapshot","reversesId")
    VALUES ('hvr-'||md5(r.id),'reverse:'||r."eventKey",r."tierId",r."warehouseId",-r.quantity,r.unit,'return_in',src,r."sourceSnapshot",r.id);
   END IF;
  END LOOP;
  RETURN;
 END IF;
 IF EXISTS(SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE reference=src AND type='return_in')
 THEN RAISE EXCEPTION '已回補的 HQ 出貨不可重新啟用，請建立新出貨單'; END IF;
 IF EXISTS(SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE reference=src AND type='sales_out') THEN RETURN; END IF;
 FOR l IN
  SELECT i.id,i."productId",i.quantity,i."variantKey",COALESCE(o."createdAt",s."createdAt") AS source_created_at FROM "ShipmentItem" i JOIN "Shipment" s ON s.id=i."shipmentId" LEFT JOIN "Order" o ON o.id=s."orderId" WHERE p_source='shipment' AND i."shipmentId"=p_id
  UNION ALL
  SELECT i.id,i."productId",i.quantity,i."variantKey",o."createdAt" AS source_created_at FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId" WHERE p_source='order' AND i."orderId"=p_id
 LOOP
  IF NOT EXISTS(SELECT 1 FROM "ProductPriceTier" WHERE "productId"=l."productId" AND inventory_policy='variant') THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM "ProductPriceTier" WHERE "productId"=l."productId" AND inventory_policy='variant' AND inventory_enabled_at<=l.source_created_at) THEN CONTINUE; END IF;
  SELECT pt.*,p.sku,p.product_category INTO t FROM "ProductPriceTier" pt JOIN "Product" p ON p.id=pt."productId"
   WHERE pt."productId"=l."productId" AND pt.id=l."variantKey" AND pt.inventory_policy='variant';
  IF NOT FOUND THEN RAISE EXCEPTION '請指定唯一有效的香氣規格'; END IF;
  IF l.source_created_at<t.inventory_enabled_at THEN CONTINUE; END IF;
  IF t.product_category <> 'STANDARD' OR l.quantity<=0 OR t."unitQty"<>1 OR t."weightGrams" IS NOT NULL
  THEN RAISE EXCEPTION '規格庫存僅支援一組對一顆的計件商品'; END IF;
  IF EXISTS(SELECT 1 FROM "ProductBundleComponent" WHERE "tierId"=t.id) THEN RAISE EXCEPTION '規格庫存不可同時使用克數拆扣'; END IF;
  stock_id := COALESCE(t.inventory_source_tier_id,t.id);
  SELECT * INTO stock_t FROM "ProductPriceTier" WHERE id=stock_id;
  IF NOT FOUND OR stock_t.inventory_policy<>'variant' OR stock_t.inventory_source_tier_id IS NOT NULL
    OR stock_t.inventory_unit IS DISTINCT FROM t.inventory_unit OR stock_t.inventory_enabled_at>l.source_created_at
  THEN RAISE EXCEPTION '共用香氣庫存來源無效'; END IF;
  SELECT * INTO b FROM "ProductVariantInventoryBalance" WHERE "tierId"=stock_id AND "warehouseId"=wh FOR UPDATE;
  IF NOT FOUND OR b.unit IS DISTINCT FROM t.inventory_unit THEN RAISE EXCEPTION '香氣規格尚未建立正確單位的庫存'; END IF;
  UPDATE "ProductVariantInventoryBalance" SET quantity=quantity-l.quantity,"updatedAt"=now() WHERE "tierId"=stock_id AND "warehouseId"=wh;
  ev:=src||':'||l.id||':variant:'||t.id;
  INSERT INTO "ProductVariantInventoryTransaction"(id,"eventKey","tierId","warehouseId",quantity,unit,type,reference,"sourceSnapshot")
  VALUES ('hvo-'||md5(ev),ev,stock_id,wh,-l.quantity,b.unit,'sales_out',src,
   jsonb_build_object('productId',l."productId",'tierId',t.id,'stockTierId',stock_id,'quantity',l.quantity,'stockUnit',b.unit,
   'unitCost',t.cost,'variantName',t.variant_name,'shopifyVariantId',t.shopify_variant_id,'recipeNote',t.notes));
 END LOOP;
END $$;
