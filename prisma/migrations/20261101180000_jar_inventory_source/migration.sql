-- 換罐只共用一般單品庫存；歷史帳冊與餘額不回填。
ALTER TABLE "Product" ADD COLUMN "inventory_source_product_id" TEXT;
ALTER TABLE "Product" ADD CONSTRAINT "Product_inventory_source_product_id_fkey" FOREIGN KEY ("inventory_source_product_id") REFERENCES "Product"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Product_inventory_source_product_id_idx" ON "Product"("inventory_source_product_id");
CREATE FUNCTION hq_validate_inventory_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.inventory_source_product_id IS NOT NULL THEN
  IF NEW.product_category <> 'JAR_EXCHANGE' OR NOT EXISTS (
   SELECT 1 FROM "Product" p WHERE p.id=NEW.inventory_source_product_id AND p.id<>NEW.id
    AND p.product_category='STANDARD' AND p.inventory_source_product_id IS NULL
    AND hq_bulk_unit(p.unit)='g'
  ) THEN RAISE EXCEPTION '換罐庫存來源必須是以克計量的一般單品'; END IF;
 END IF;
 IF EXISTS (SELECT 1 FROM "Product" p WHERE p.inventory_source_product_id=NEW.id)
  AND (NEW.product_category<>'STANDARD' OR hq_bulk_unit(NEW.unit) IS DISTINCT FROM 'g' OR NEW.inventory_source_product_id IS NOT NULL)
 THEN RAISE EXCEPTION '此單品仍供換罐扣庫存，不可變更其庫存單位或類型'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hq_product_inventory_source BEFORE INSERT OR UPDATE ON "Product" FOR EACH ROW EXECUTE FUNCTION hq_validate_inventory_source();
CREATE OR REPLACE FUNCTION hq_bulk_post(p_source TEXT, p_id TEXT, p_reverse BOOLEAN) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 src TEXT := p_source || ':' || p_id;
 wh TEXT;
 row RECORD;
 line RECORD;
 tier RECORD;
 actual_unit TEXT;
 amount INTEGER;
 tier_count INTEGER;
 event_key TEXT;
 balance_unit TEXT;
 source_product RECORD;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
 SELECT id INTO wh FROM "Warehouse" WHERE code='WH-MAIN';
 IF wh IS NULL THEN RAISE EXCEPTION 'HQ 主倉 WH-MAIN 不存在'; END IF;
 IF p_reverse THEN
   FOR row IN SELECT * FROM "InventoryTransaction" WHERE reference=src AND type='sales_out' AND "eventKey" IS NOT NULL ORDER BY "productId" LOOP
     IF NOT EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE "reversesId"=row.id) THEN
       UPDATE "InventoryBalance" SET quantity=quantity-row.quantity,"updatedAt"=now()
         WHERE "productId"=row."productId" AND "warehouseId"=wh AND unit=row.unit;
       IF NOT FOUND THEN RAISE EXCEPTION 'HQ 回補單位不一致：%',row."productId"; END IF;
       INSERT INTO "InventoryTransaction" (id,"txnNumber",type,"productId","warehouseId",quantity,reference,note,unit,"eventKey","reversesId")
       VALUES ('hqr-'||md5(row.id),'HQR-'||md5(row.id),'return_in',row."productId",wh,-row.quantity,src,'取消／退貨反向回補；原始扣帳 '||row."txnNumber",row.unit,'reverse:'||row."eventKey",row.id);
     END IF;
   END LOOP;
   RETURN;
 END IF;
 IF EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference=src AND "eventKey" LIKE 'reverse:%') THEN
   RAISE EXCEPTION '已回補的 HQ 出貨不可重新啟用，請建立新出貨單';
 END IF;
 IF EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference=src AND type='sales_out' AND "eventKey" IS NOT NULL) THEN RETURN; END IF;
 FOR line IN
   SELECT i.id,i."productId",i.quantity,i."weightGrams",i.unit,i."variantKey" FROM "ShipmentItem" i WHERE p_source='shipment' AND i."shipmentId"=p_id
   UNION ALL
   SELECT i.id,i."productId",i.quantity,i."weightGrams",i.unit,i."variantKey" FROM "OrderItem" i WHERE p_source='order' AND i."orderId"=p_id
 LOOP
   SELECT * INTO row FROM "Product" WHERE id=line."productId";
   IF row.product_category <> 'JAR_EXCHANGE' AND row.category NOT IN ('staple_food','treats','freeze_dried','health') THEN CONTINUE; END IF;
   -- 原味雞霸為接單現做；不要求現貨、不扣 HQ 庫存。
   IF upper(row.sku)='FUR-0002' THEN CONTINUE; END IF;
   IF row.product_category='JAR_EXCHANGE' THEN
     SELECT * INTO source_product FROM "Product" WHERE id=row.inventory_source_product_id
       AND product_category='STANDARD' AND status='active' AND inventory_source_product_id IS NULL;
     IF NOT FOUND OR hq_bulk_unit(source_product.unit) IS DISTINCT FROM 'g' THEN
       RAISE EXCEPTION '換罐商品 % 尚未設定有效的庫存來源單品',row.sku;
     END IF;
     actual_unit := 'g';
   ELSE
     actual_unit := hq_bulk_unit(row.unit);
   END IF;
   IF actual_unit IS NULL THEN RAISE EXCEPTION 'HQ 商品 % 實際單位尚未確認',row.sku; END IF;
   IF line.quantity <= 0 THEN RAISE EXCEPTION 'HQ 出貨數量必須大於零'; END IF;
   SELECT count(*) INTO tier_count FROM "ProductPriceTier" t WHERE t."productId"=row.id
     AND (CASE WHEN line."variantKey" IS NOT NULL THEN t.id=line."variantKey"
       WHEN actual_unit='g' THEN line."weightGrams" IS NOT NULL AND t."weightGrams"=line."weightGrams"
       ELSE t."weightGrams" IS NOT DISTINCT FROM line."weightGrams" AND t.unit=actual_unit END);
   IF tier_count <> 1 THEN RAISE EXCEPTION 'HQ 商品 % 缺少或無法唯一確認規格，請指定商品規格',row.sku; END IF;
   SELECT * INTO tier FROM "ProductPriceTier" t WHERE t."productId"=row.id
     AND (CASE WHEN line."variantKey" IS NOT NULL THEN t.id=line."variantKey"
       WHEN actual_unit='g' THEN t."weightGrams"=line."weightGrams"
       ELSE t."weightGrams" IS NOT DISTINCT FROM line."weightGrams" AND t.unit=actual_unit END);
   IF actual_unit='g' THEN
     IF tier."weightGrams" IS NULL OR tier."weightGrams" <= 0 OR line."weightGrams" IS DISTINCT FROM tier."weightGrams" THEN RAISE EXCEPTION 'HQ 重量規格不一致：%',row.sku; END IF;
     amount := tier."weightGrams" * line.quantity;
   ELSE
     IF tier.unit <> actual_unit OR tier."unitQty" <= 0 THEN RAISE EXCEPTION 'HQ 實際單位規格不一致：%',row.sku; END IF;
     amount := tier."unitQty" * line.quantity;
   END IF;

   -- 規格依換罐商品驗證，實際扣帳身份依來源單品保存；取消仍循原始帳冊。
   IF row.product_category='JAR_EXCHANGE' THEN row := source_product; END IF;
   SELECT unit INTO balance_unit FROM "InventoryBalance" WHERE "productId"=row.id AND "warehouseId"=wh;
   IF NOT FOUND THEN
     INSERT INTO "InventoryBalance" (id,"productId","warehouseId",quantity,unit,"countNote","updatedAt")
     VALUES ('hqb-'||md5(row.id||':'||wh),row.id,wh,0,actual_unit,'未盤點即出貨；以 0 起算並保留負庫存提醒',now());
   ELSIF balance_unit IS NULL THEN
     UPDATE "InventoryBalance" SET quantity=0,unit=actual_unit,"countNote"='未盤點即出貨；舊數字未採用，以 0 起算並保留負庫存提醒',"updatedAt"=now()
       WHERE "productId"=row.id AND "warehouseId"=wh;
   ELSIF balance_unit IS DISTINCT FROM actual_unit THEN
     RAISE EXCEPTION 'HQ 商品 % 實際單位不一致',row.sku;
   END IF;

   UPDATE "InventoryBalance" SET quantity=quantity-amount,"updatedAt"=now()
     WHERE "productId"=row.id AND "warehouseId"=wh;
   event_key := src||':'||line.id;
   INSERT INTO "InventoryTransaction" (id,"txnNumber",type,"productId","warehouseId",quantity,reference,note,unit,"eventKey")
   VALUES ('hqo-'||md5(event_key),'HQO-'||md5(event_key),'sales_out',row.id,wh,-amount,src,
     jsonb_build_array(jsonb_build_object('tierId',tier.id,'quantity',line.quantity,'consumption',amount,'unit',actual_unit))::TEXT,actual_unit,event_key)
   ON CONFLICT ("eventKey") DO NOTHING;
 END LOOP;
END $$;
