-- A confirmed HQ correction may return an unhanded-off shipment to pending.
-- The inventory ledger remains immutable: every prior deduction is reversed,
-- and a later shipment creates a fresh deduction cycle.
CREATE OR REPLACE FUNCTION hq_bulk_mark_eligible() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   NEW."hqInventoryEligible" := NEW.status IN ('shipped','delivered','received','completed');
 ELSE
   IF OLD."hqInventoryEligible" AND OLD.status IN ('cancelled','returned') AND NEW.status IN ('shipped','delivered','received','completed') THEN
     RAISE EXCEPTION '已取消或退貨的 HQ 出貨不能重新啟用，請建立新單';
   END IF;
   IF OLD."hqInventoryEligible" AND OLD.status IN ('shipped','delivered','received','completed') AND NEW.status IN ('pending_review','draft','confirmed','packed') THEN
     RAISE EXCEPTION '已出貨不能退回此狀態；僅可由 HQ 物流修正回待出貨';
   END IF;
   NEW."hqInventoryEligible" := OLD."hqInventoryEligible" OR
     (OLD.status NOT IN ('shipped','delivered','received','completed','cancelled','returned') AND
      NEW.status IN ('shipped','delivered','received','completed'));
 END IF;
 RETURN NEW;
END $$;

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
 post_cycle INTEGER;
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
       VALUES ('hqr-'||md5(row.id),'HQR-'||md5(row.id),'return_in',row."productId",wh,-row.quantity,src,'物流狀態撤回反向回補；原始扣帳 '||row."txnNumber",row.unit,'reverse:'||row."eventKey",row.id);
     END IF;
   END LOOP;
   RETURN;
 END IF;
 IF EXISTS (
   SELECT 1 FROM "InventoryTransaction" sales
   WHERE sales.reference=src AND sales.type='sales_out' AND sales."eventKey" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "InventoryTransaction" reversal WHERE reversal."reversesId"=sales.id)
 ) THEN RETURN; END IF;
 SELECT count(*) INTO post_cycle FROM "InventoryTransaction" WHERE reference=src AND type='sales_out' AND "eventKey" IS NOT NULL;
 FOR line IN
   SELECT i.id,i."productId",i.quantity,i."weightGrams",i.unit,i."variantKey" FROM "ShipmentItem" i WHERE p_source='shipment' AND i."shipmentId"=p_id
   UNION ALL
   SELECT i.id,i."productId",i.quantity,i."weightGrams",i.unit,i."variantKey" FROM "OrderItem" i WHERE p_source='order' AND i."orderId"=p_id
 LOOP
   SELECT * INTO row FROM "Product" WHERE id=line."productId";
   IF row.category NOT IN ('staple_food','treats','freeze_dried','health') THEN CONTINUE; END IF;
   actual_unit := hq_bulk_unit(row.unit);
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
   SELECT unit INTO balance_unit FROM "InventoryBalance" WHERE "productId"=row.id AND "warehouseId"=wh;
   IF balance_unit IS DISTINCT FROM actual_unit THEN RAISE EXCEPTION 'HQ 商品 % 尚未完成實際單位盤點',row.sku; END IF;
   UPDATE "InventoryBalance" SET quantity=quantity-amount,"updatedAt"=now() WHERE "productId"=row.id AND "warehouseId"=wh AND quantity>=amount;
   IF NOT FOUND THEN RAISE EXCEPTION 'HQ 商品 % 庫存不足，需要 % %',row.sku,amount,actual_unit; END IF;
   event_key := src||':'||line.id||':cycle:'||post_cycle;
   INSERT INTO "InventoryTransaction" (id,"txnNumber",type,"productId","warehouseId",quantity,reference,note,unit,"eventKey")
   VALUES ('hqo-'||md5(event_key),'HQO-'||md5(event_key),'sales_out',row.id,wh,-amount,src,
     jsonb_build_array(jsonb_build_object('tierId',tier.id,'quantity',line.quantity,'consumption',amount,'unit',actual_unit))::TEXT,actual_unit,event_key);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION hq_bulk_sync_shipment(p_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s RECORD; o RECORD; reverse_it BOOLEAN;
BEGIN
 SELECT * INTO s FROM "Shipment" WHERE id=p_id;
 IF NOT FOUND OR NOT s."hqInventoryEligible" THEN RETURN; END IF;
 reverse_it := s.status IN ('cancelled','returned') OR s.status='pending';
 IF s."orderId" IS NOT NULL THEN
   SELECT * INTO o FROM "Order" WHERE id=s."orderId";
   IF EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference='order:'||s."orderId" AND "eventKey" IS NOT NULL) THEN
     RAISE EXCEPTION '此訂單已直接扣帳，不可再以出貨單重扣';
   END IF;
   reverse_it := reverse_it OR o.status IN ('cancelled','returned') OR o."fulfillmentStatus"='returned' OR o."paymentStatus"='refunded';
   IF NOT reverse_it AND EXISTS (
     SELECT 1 FROM "InventoryTransaction" sales WHERE sales.reference='shipment:'||p_id AND sales.type='sales_out' AND sales."eventKey" IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM "InventoryTransaction" reversal WHERE reversal."reversesId"=sales.id)
   ) THEN RETURN; END IF;
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
