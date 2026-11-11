
ALTER TABLE "ProductPriceTier"
 ADD COLUMN "inventory_policy" TEXT NOT NULL DEFAULT 'shared',
 ADD COLUMN "inventory_unit" TEXT,
 ADD COLUMN "inventory_enabled_at" TIMESTAMP(3);
ALTER TABLE "ProductPriceTier" ADD CONSTRAINT "tier_inventory_policy_check"
 CHECK ("inventory_policy" IN ('shared','variant') AND
 ("inventory_policy" <> 'variant' OR ("inventory_enabled_at" IS NOT NULL AND "inventory_unit" IS NOT NULL AND "inventory_unit" IN ('組','顆','件') AND "unitQty"=1 AND "weightGrams" IS NULL)));
CREATE TABLE "ProductVariantInventoryBalance" (
 "tierId" TEXT NOT NULL REFERENCES "ProductPriceTier"(id) ON DELETE RESTRICT,
 "warehouseId" TEXT NOT NULL REFERENCES "Warehouse"(id) ON DELETE RESTRICT,
 quantity INTEGER NOT NULL DEFAULT 0,
 unit TEXT NOT NULL CHECK (unit IN ('組','顆','件')),
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY ("tierId","warehouseId")
);
CREATE TABLE "ProductVariantInventoryTransaction" (
 id TEXT PRIMARY KEY,
 "eventKey" TEXT NOT NULL UNIQUE,
 "tierId" TEXT NOT NULL REFERENCES "ProductPriceTier"(id) ON DELETE RESTRICT,
 "warehouseId" TEXT NOT NULL REFERENCES "Warehouse"(id) ON DELETE RESTRICT,
 quantity INTEGER NOT NULL,
 unit TEXT NOT NULL CHECK (unit IN ('組','顆','件')),
 type TEXT NOT NULL CHECK (type IN ('opening','sales_out','return_in')),
 reference TEXT NOT NULL,
 "sourceSnapshot" JSONB NOT NULL,
 "reversesId" TEXT UNIQUE REFERENCES "ProductVariantInventoryTransaction"(id) ON DELETE RESTRICT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ((type='sales_out' AND quantity<0 AND "reversesId" IS NULL)
 OR (type='return_in' AND quantity>0 AND "reversesId" IS NOT NULL)
 OR (type='opening' AND quantity>=0 AND "reversesId" IS NULL))
);
CREATE INDEX "ProductVariantInventoryTransaction_reference_idx" ON "ProductVariantInventoryTransaction"(reference);
ALTER TABLE "ProductVariantInventoryBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductVariantInventoryTransaction" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "ProductVariantInventoryBalance","ProductVariantInventoryTransaction" FROM PUBLIC;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
 REVOKE ALL ON "ProductVariantInventoryBalance","ProductVariantInventoryTransaction" FROM anon;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
 REVOKE ALL ON "ProductVariantInventoryBalance","ProductVariantInventoryTransaction" FROM authenticated;
 END IF;
END $$;
CREATE FUNCTION hq_variant_ledger_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '規格庫存帳冊不可改寫或刪除，請新增反向紀錄'; END $$;
CREATE TRIGGER variant_ledger_immutable BEFORE UPDATE OR DELETE ON "ProductVariantInventoryTransaction"
 FOR EACH ROW EXECUTE FUNCTION hq_variant_ledger_immutable();

CREATE FUNCTION hq_variant_post(p_source TEXT,p_id TEXT,p_reverse BOOLEAN) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
 src TEXT := p_source||':'||p_id;
 wh TEXT;
 l RECORD;
 t RECORD;
 b RECORD;
 r RECORD;
 ev TEXT;
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
  SELECT * INTO b FROM "ProductVariantInventoryBalance" WHERE "tierId"=t.id AND "warehouseId"=wh FOR UPDATE;
  IF NOT FOUND OR b.unit IS DISTINCT FROM t.inventory_unit THEN RAISE EXCEPTION '香氣規格尚未建立正確單位的庫存'; END IF;
  UPDATE "ProductVariantInventoryBalance" SET quantity=quantity-l.quantity,"updatedAt"=now() WHERE "tierId"=t.id AND "warehouseId"=wh;
  ev:=src||':'||l.id||':variant:'||t.id;
  INSERT INTO "ProductVariantInventoryTransaction"(id,"eventKey","tierId","warehouseId",quantity,unit,type,reference,"sourceSnapshot")
  VALUES ('hvo-'||md5(ev),ev,t.id,wh,-l.quantity,b.unit,'sales_out',src,
   jsonb_build_object('productId',l."productId",'tierId',t.id,'quantity',l.quantity,'stockUnit',b.unit,
   'unitCost',t.cost,'variantName',t.variant_name,'shopifyVariantId',t.shopify_variant_id,'recipeNote',t.notes));
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION hq_variant_post(TEXT,TEXT,BOOLEAN), hq_variant_ledger_immutable() FROM PUBLIC;

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
 component RECORD;
 component_total INTEGER;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
 PERFORM hq_variant_post(p_source,p_id,p_reverse);
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
   IF EXISTS (SELECT 1 FROM "ProductPriceTier" WHERE "productId"=line."productId" AND inventory_policy='variant') THEN CONTINUE; END IF;
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

   -- 組合使用規格的配方，出貨才扣單品；成品不另扣，避免重複計量。
   IF EXISTS (SELECT 1 FROM "ProductBundleComponent" WHERE "tierId"=tier.id) THEN
     IF row.product_category <> 'STANDARD' OR actual_unit <> 'g' THEN
       RAISE EXCEPTION '組合必須是以克計量的一般商品';
     END IF;
     SELECT sum("gramsPerPack") INTO component_total FROM "ProductBundleComponent" WHERE "tierId"=tier.id;
     IF component_total IS DISTINCT FROM tier."weightGrams" THEN RAISE EXCEPTION '組合配方重量與規格不一致'; END IF;
     FOR component IN SELECT c.*,p.unit,p.sku,p.product_category,p.inventory_source_product_id
       FROM "ProductBundleComponent" c JOIN "Product" p ON p.id=c."componentProductId"
       WHERE c."tierId"=tier.id ORDER BY c."componentProductId"
     LOOP
       IF component.product_category <> 'STANDARD' OR hq_bulk_unit(component.unit) IS DISTINCT FROM 'g'
         OR component.inventory_source_product_id IS NOT NULL
         OR EXISTS(SELECT 1 FROM "ProductPriceTier" ct JOIN "ProductBundleComponent" cc ON cc."tierId"=ct.id WHERE ct."productId"=component."componentProductId")
       THEN RAISE EXCEPTION '組合原料單位或來源無效：%',component.sku; END IF;
       amount := component."gramsPerPack" * line.quantity;
       SELECT unit INTO balance_unit FROM "InventoryBalance" WHERE "productId"=component."componentProductId" AND "warehouseId"=wh;
       IF balance_unit IS DISTINCT FROM 'g' THEN RAISE EXCEPTION '組合原料尚未完成克數盤點：%',component.sku; END IF;
       -- 沿用 HQ advisory 負庫存規則；不修改其他商品的庫存政策。
       UPDATE "InventoryBalance" SET quantity=quantity-amount,"updatedAt"=now()
         WHERE "productId"=component."componentProductId" AND "warehouseId"=wh;
       event_key := src||':'||line.id||':component:'||component."componentProductId";
       INSERT INTO "InventoryTransaction" (id,"txnNumber",type,"productId","warehouseId",quantity,reference,note,unit,"eventKey")
       VALUES ('hqo-'||md5(event_key),'HQO-'||md5(event_key),'sales_out',component."componentProductId",wh,-amount,src,
         jsonb_build_array(jsonb_build_object('bundleProductId',row.id,'tierId',tier.id,'quantity',line.quantity,'gramsPerPack',component."gramsPerPack",'consumption',amount,'unit','g'))::text,'g',event_key);
     END LOOP;
     CONTINUE;
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



CREATE OR REPLACE FUNCTION hq_bulk_sync_shipment(p_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s RECORD; o RECORD; reverse_it BOOLEAN;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
 SELECT * INTO s FROM "Shipment" WHERE id=p_id;
 IF NOT FOUND OR NOT s."hqInventoryEligible" THEN RETURN; END IF;
 reverse_it := s.status IN ('cancelled','returned');
 IF s."orderId" IS NOT NULL THEN
   SELECT * INTO o FROM "Order" WHERE id=s."orderId";
   IF (EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference='order:'||s."orderId" AND "eventKey" IS NOT NULL) OR EXISTS (SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE reference='order:'||s."orderId")) THEN
     RAISE EXCEPTION '此訂單已直接扣帳，不可再以出貨單重扣';
   END IF;
   reverse_it := reverse_it OR o.status IN ('cancelled','returned') OR o."fulfillmentStatus"='returned' OR o."paymentStatus"='refunded';
   IF NOT reverse_it AND (EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference='shipment:'||p_id AND type='sales_out' AND "eventKey" IS NOT NULL) OR EXISTS (SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE reference='shipment:'||p_id AND type='sales_out')) THEN RETURN; END IF;
   IF NOT reverse_it AND o.oms_status IS NOT NULL AND
     (o.oms_status::TEXT NOT IN ('READY','FULFILLMENT_PENDING','FULFILLED') OR o.oms_reviewed_at IS NULL OR o.oms_reviewed_by_id IS NULL OR o.deleted_at IS NOT NULL
       OR o.oms_checked_at IS NULL OR o.shopify_source_updated_at IS NULL OR o.oms_checked_source_updated_at IS DISTINCT FROM o.shopify_source_updated_at
       OR o.oms_issue_flags IS NULL OR jsonb_typeof(o.oms_issue_flags) <> 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.oms_issue_flags)='array' THEN o.oms_issue_flags ELSE '[]'::jsonb END) flag WHERE flag->>'severity'='blocking')) THEN
     RAISE EXCEPTION 'HQ 出貨尚未通過 OMS 人工審核';
   END IF;
 END IF;
 IF reverse_it THEN PERFORM hq_bulk_post('shipment',p_id,true);
 ELSIF s.status IN ('shipped','delivered','received') THEN PERFORM hq_bulk_post('shipment',p_id,false);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION hq_bulk_sync_order(p_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE o RECORD; s RECORD; reverse_it BOOLEAN;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
 SELECT * INTO o FROM "Order" WHERE id=p_id;
 IF NOT FOUND THEN RETURN; END IF;
 reverse_it := o.status IN ('cancelled','returned') OR o."fulfillmentStatus"='returned' OR o."paymentStatus"='refunded';
 IF reverse_it THEN PERFORM hq_bulk_post('order',p_id,true); END IF;
 FOR s IN SELECT id FROM "Shipment" WHERE "orderId"=p_id ORDER BY id LOOP
   PERFORM hq_bulk_sync_shipment(s.id);
 END LOOP;
 IF EXISTS(SELECT 1 FROM "Shipment" WHERE "orderId"=p_id) OR NOT o."hqInventoryEligible" OR reverse_it THEN RETURN; END IF;
 IF o.status IN ('shipped','delivered','completed') THEN
   IF (EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference='order:'||p_id AND type='sales_out' AND "eventKey" IS NOT NULL) OR EXISTS (SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE reference='order:'||p_id AND type='sales_out')) THEN RETURN; END IF;
   IF o.oms_status IS NOT NULL AND (o.oms_status::TEXT NOT IN ('READY','FULFILLMENT_PENDING','FULFILLED') OR o.oms_reviewed_at IS NULL OR o.oms_reviewed_by_id IS NULL OR o.deleted_at IS NOT NULL
       OR o.oms_checked_at IS NULL OR o.shopify_source_updated_at IS NULL OR o.oms_checked_source_updated_at IS DISTINCT FROM o.shopify_source_updated_at
       OR o.oms_issue_flags IS NULL OR jsonb_typeof(o.oms_issue_flags) <> 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.oms_issue_flags)='array' THEN o.oms_issue_flags ELSE '[]'::jsonb END) flag WHERE flag->>'severity'='blocking')) THEN
     RAISE EXCEPTION 'HQ 訂單尚未通過 OMS 人工審核';
   END IF;
   PERFORM hq_bulk_post('order',p_id,false);
 END IF;
END $$;

CREATE OR REPLACE FUNCTION hq_bulk_protect_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_key TEXT;
BEGIN
 IF TG_TABLE_NAME='OrderItem' THEN source_key := 'order:'||CASE WHEN TG_OP='INSERT' THEN NEW."orderId" ELSE OLD."orderId" END;
 ELSE source_key := 'shipment:'||CASE WHEN TG_OP='INSERT' THEN NEW."shipmentId" ELSE OLD."shipmentId" END; END IF;
 IF (EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference=source_key AND "eventKey" IS NOT NULL) OR EXISTS (SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE reference=source_key)) THEN
   RAISE EXCEPTION '已扣帳明細不可改寫或刪除，請先取消並建立新單';
 END IF;
 IF TG_OP='UPDATE' THEN
   IF TG_TABLE_NAME='OrderItem' THEN source_key := 'order:'||NEW."orderId";
   ELSE source_key := 'shipment:'||NEW."shipmentId"; END IF;
   IF EXISTS (SELECT 1 FROM "ProductVariantInventoryTransaction" WHERE reference=source_key)
   THEN RAISE EXCEPTION '已扣帳明細不可改寫或刪除，請先取消並建立新單'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
