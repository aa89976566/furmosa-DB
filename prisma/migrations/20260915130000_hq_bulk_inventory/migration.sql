ALTER TABLE "OrderItem" ADD COLUMN "variantKey" TEXT;
-- Additive: legacy quantities retain their original meaning until explicitly counted.
ALTER TABLE "InventoryBalance" ADD COLUMN "unit" TEXT, ADD COLUMN "lastCountedAt" TIMESTAMP(3), ADD COLUMN "countNote" TEXT;
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_counted_nonnegative" CHECK ("unit" IS NULL OR quantity >= 0);
ALTER TABLE "InventoryTransaction" ADD COLUMN "unit" TEXT, ADD COLUMN "eventKey" TEXT, ADD COLUMN "reversesId" TEXT;
CREATE UNIQUE INDEX "InventoryTransaction_eventKey_key" ON "InventoryTransaction"("eventKey");
CREATE UNIQUE INDEX "InventoryTransaction_reversesId_key" ON "InventoryTransaction"("reversesId");
ALTER TABLE "InventoryTransaction" ADD CONSTRAINT "InventoryTransaction_reversesId_fkey" FOREIGN KEY ("reversesId") REFERENCES "InventoryTransaction"(id) ON DELETE RESTRICT;
ALTER TABLE "Order" ADD COLUMN "hqInventoryEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Shipment" ADD COLUMN "hqInventoryEligible" BOOLEAN NOT NULL DEFAULT false;

-- Unit is determined by master, never inferred from a display name.
CREATE FUNCTION hq_bulk_unit(p_unit TEXT) RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
 SELECT CASE WHEN p_unit IN ('g','克','公克') THEN 'g' WHEN p_unit IN ('隻','片','顆','條') THEN p_unit ELSE NULL END
$$;

-- A source is an individual shipment, or an order with no shipment. Historical
-- completed sources remain ineligible, including when a delivery webhook arrives.
CREATE FUNCTION hq_bulk_mark_eligible() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
   NEW."hqInventoryEligible" := NEW.status IN ('shipped','delivered','received','completed');
 ELSE
   IF OLD."hqInventoryEligible" AND OLD.status IN ('shipped','delivered','received','completed') AND NEW.status IN ('pending','pending_review','draft','confirmed','packed') THEN
     RAISE EXCEPTION '已出貨不能退回未完成狀態，請使用取消／退貨留下回補紀錄';
   END IF;
   NEW."hqInventoryEligible" := OLD."hqInventoryEligible" OR
     (OLD.status NOT IN ('shipped','delivered','received','completed','cancelled','returned') AND
      NEW.status IN ('shipped','delivered','received','completed'));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hq_bulk_order_eligible BEFORE INSERT OR UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION hq_bulk_mark_eligible();
CREATE TRIGGER hq_bulk_shipment_eligible BEFORE INSERT OR UPDATE ON "Shipment" FOR EACH ROW EXECUTE FUNCTION hq_bulk_mark_eligible();

CREATE FUNCTION hq_bulk_post(p_source TEXT, p_id TEXT, p_reverse BOOLEAN) RETURNS void LANGUAGE plpgsql AS $$
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
BEGIN
 -- Shared lock ensures deterministic ledger and balance writes across every writer.
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
 -- Posted amounts are immutable snapshots; changes to master never recalculate them.
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
   -- Same Product across weight tiers shares one balance; each line is independently auditable.
   event_key := src||':'||line.id;
   INSERT INTO "InventoryTransaction" (id,"txnNumber",type,"productId","warehouseId",quantity,reference,note,unit,"eventKey")
   VALUES ('hqo-'||md5(event_key),'HQO-'||md5(event_key),'sales_out',row.id,wh,-amount,src,
     jsonb_build_array(jsonb_build_object('tierId',tier.id,'quantity',line.quantity,'consumption',amount,'unit',actual_unit))::TEXT,actual_unit,event_key)
   ON CONFLICT ("eventKey") DO NOTHING;
 END LOOP;
END $$;

CREATE FUNCTION hq_bulk_sync_shipment(p_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s RECORD; o RECORD; reverse_it BOOLEAN;
BEGIN
 SELECT * INTO s FROM "Shipment" WHERE id=p_id;
 IF NOT FOUND OR NOT s."hqInventoryEligible" THEN RETURN; END IF;
 reverse_it := s.status IN ('cancelled','returned');
 IF s."orderId" IS NOT NULL THEN
   SELECT * INTO o FROM "Order" WHERE id=s."orderId";
   IF EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference='order:'||s."orderId" AND "eventKey" IS NOT NULL) THEN
     RAISE EXCEPTION '此訂單已直接扣帳，不可再以出貨單重扣';
   END IF;
   reverse_it := reverse_it OR o.status IN ('cancelled','returned') OR o."fulfillmentStatus"='returned' OR o."paymentStatus"='refunded';
   IF NOT reverse_it AND EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference='shipment:'||p_id AND type='sales_out' AND "eventKey" IS NOT NULL) THEN RETURN; END IF;
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

CREATE FUNCTION hq_bulk_sync_order(p_id TEXT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE o RECORD; s RECORD; reverse_it BOOLEAN;
BEGIN
 SELECT * INTO o FROM "Order" WHERE id=p_id;
 IF NOT FOUND THEN RETURN; END IF;
 reverse_it := o.status IN ('cancelled','returned') OR o."fulfillmentStatus"='returned' OR o."paymentStatus"='refunded';
 IF reverse_it THEN PERFORM hq_bulk_post('order',p_id,true); END IF;
 FOR s IN SELECT id FROM "Shipment" WHERE "orderId"=p_id ORDER BY id LOOP
   PERFORM hq_bulk_sync_shipment(s.id);
 END LOOP;
 IF EXISTS(SELECT 1 FROM "Shipment" WHERE "orderId"=p_id) OR NOT o."hqInventoryEligible" OR reverse_it THEN RETURN; END IF;
 IF o.status IN ('shipped','delivered','completed') THEN
   IF EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference='order:'||p_id AND type='sales_out' AND "eventKey" IS NOT NULL) THEN RETURN; END IF;
   IF o.oms_status IS NOT NULL AND (o.oms_status::TEXT NOT IN ('READY','FULFILLMENT_PENDING','FULFILLED') OR o.oms_reviewed_at IS NULL OR o.oms_reviewed_by_id IS NULL OR o.deleted_at IS NOT NULL
       OR o.oms_checked_at IS NULL OR o.shopify_source_updated_at IS NULL OR o.oms_checked_source_updated_at IS DISTINCT FROM o.shopify_source_updated_at
       OR o.oms_issue_flags IS NULL OR jsonb_typeof(o.oms_issue_flags) <> 'array'
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(o.oms_issue_flags)='array' THEN o.oms_issue_flags ELSE '[]'::jsonb END) flag WHERE flag->>'severity'='blocking')) THEN
     RAISE EXCEPTION 'HQ 訂單尚未通過 OMS 人工審核';
   END IF;
   PERFORM hq_bulk_post('order',p_id,false);
 END IF;
END $$;

-- Deferred: sees final transaction state after nested line-item creation, and
-- rolls status + inventory back together if any item cannot be posted.
CREATE FUNCTION hq_bulk_dispatch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='Order' THEN PERFORM hq_bulk_sync_order(NEW.id);
 ELSE PERFORM hq_bulk_sync_shipment(NEW.id); END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER hq_bulk_order_post AFTER INSERT OR UPDATE ON "Order" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hq_bulk_dispatch();
CREATE CONSTRAINT TRIGGER hq_bulk_shipment_post AFTER INSERT OR UPDATE ON "Shipment" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hq_bulk_dispatch();



CREATE FUNCTION hq_bulk_protect_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."eventKey" IS NOT NULL THEN
   -- Ledger entries can only be corrected by a new inverse entry.
   IF true THEN
     RAISE EXCEPTION 'HQ 庫存帳冊不可改寫或刪除，請新增反向紀錄';
   END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hq_bulk_ledger_immutable BEFORE UPDATE OR DELETE ON "InventoryTransaction" FOR EACH ROW EXECUTE FUNCTION hq_bulk_protect_ledger();

CREATE FUNCTION hq_bulk_protect_lines() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source_key TEXT;
BEGIN
 IF TG_TABLE_NAME='OrderItem' THEN source_key := 'order:'||CASE WHEN TG_OP='INSERT' THEN NEW."orderId" ELSE OLD."orderId" END;
 ELSE source_key := 'shipment:'||CASE WHEN TG_OP='INSERT' THEN NEW."shipmentId" ELSE OLD."shipmentId" END; END IF;
 IF EXISTS (SELECT 1 FROM "InventoryTransaction" WHERE reference=source_key AND "eventKey" IS NOT NULL) THEN
   RAISE EXCEPTION '已扣帳明細不可改寫或刪除，請先取消並建立新單';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hq_bulk_order_lines BEFORE INSERT OR UPDATE OR DELETE ON "OrderItem" FOR EACH ROW EXECUTE FUNCTION hq_bulk_protect_lines();
CREATE TRIGGER hq_bulk_shipment_lines BEFORE INSERT OR UPDATE OR DELETE ON "ShipmentItem" FOR EACH ROW EXECUTE FUNCTION hq_bulk_protect_lines();
