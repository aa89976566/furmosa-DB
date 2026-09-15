-- Explicit user-authorized baseline, matched by primary key + SKU + source SKU.
-- Run only after 20260915130000_hq_bulk_inventory; repeat is a no-op.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('hq:bulk-inventory:v1',0));
DO $$
DECLARE r RECORD; p RECORD; wh TEXT; old_qty INTEGER; old_unit TEXT; event_key TEXT;
BEGIN
 SELECT id INTO STRICT wh FROM "Warehouse" WHERE code='WH-MAIN';
 FOR r IN SELECT * FROM (VALUES
 ('cmp2iftaa007sqw9lbqx9q07f','FUR-0028','FD-10','水晶魚凍乾',400,'g','水晶魚'),
 ('cmp2ifapp0066qw9lcu5d5wia','FUR-0022','FD-08','牛肉丁凍乾',300,'g','牛肉丁'),
 ('cmp2ifche006gqw9l1xfpkdob','FUR-0024','FD-11','雞肉丁凍乾',1300,'g','雞肉丁'),
 ('cmp2ifbo8006cqw9lcfk6xfg4','FUR-0023','FD-09','丁香魚凍乾',300,'g','丁香魚'),
 ('cmp2idtgw0007qw9l5sjnh039','FUR-0003','FD-12','混合蔬果凍乾',500,'g','蔬果'),
 ('cmpo22dnp002311hhappr1nj3','FUR-0031','FD-05','鵪鶉凍乾',4,'隻','鵪鶉乾')
 ) AS x(id,sku,source_sku,name,qty,unit,requested_name) LOOP
 SELECT * INTO STRICT p FROM "Product" WHERE id=r.id AND sku=r.sku AND "sourceSku"=r.source_sku AND name=r.name AND status='active' AND product_category='STANDARD';
 IF hq_bulk_unit(p.unit) IS DISTINCT FROM r.unit THEN RAISE EXCEPTION 'Master unit changed: %',r.sku; END IF;
 event_key := 'stocktake:2026-09-15:manual-approx:'||r.id;
 IF EXISTS(SELECT 1 FROM "InventoryTransaction" WHERE "eventKey"=event_key) THEN CONTINUE; END IF;
 SELECT quantity,unit INTO old_qty,old_unit FROM "InventoryBalance" WHERE "productId"=r.id AND "warehouseId"=wh FOR UPDATE;
 IF old_unit IS NULL AND coalesce(old_qty,0)<>0 THEN RAISE EXCEPTION 'Legacy nonzero quantity requires reviewed unit conversion: %',r.sku; END IF;
 INSERT INTO "InventoryBalance" (id,"productId","warehouseId",quantity,unit,"lastCountedAt","countNote","updatedAt")
 VALUES ('hqb-'||md5(r.id||wh),r.id,wh,r.qty,r.unit,'2026-09-15 00:00:00','人工盤點（約略）｜2026-09-15；未提供精確時間',now())
 ON CONFLICT ("productId","warehouseId") DO UPDATE SET quantity=EXCLUDED.quantity,unit=EXCLUDED.unit,"lastCountedAt"=EXCLUDED."lastCountedAt","countNote"=EXCLUDED."countNote","updatedAt"=now();
 INSERT INTO "InventoryTransaction" (id,"txnNumber",type,"productId","warehouseId",quantity,reference,note,unit,"eventKey")
 VALUES ('hqc-'||md5(event_key),'HQC-'||md5(event_key),'stocktake',r.id,wh,r.qty-coalesce(old_qty,0),'人工盤點（約略）2026-09-15',
 jsonb_build_object('requestedName',r.requested_name,'masterName',p.name,'productId',p.id,'sku',p.sku,'sourceSku',p."sourceSku",'previousQuantity',coalesce(old_qty,0),'previousUnit',old_unit,'countedQuantity',r.qty,'approximate',true,'countDate','2026-09-15','identityEvidence','STANDARD product master; JAR_EXCHANGE products are distinct identities')::TEXT,r.unit,event_key);
 END LOOP;
END $$;
COMMIT;
SELECT p.sku,p."sourceSku",p.name,b.quantity,b.unit,b."lastCountedAt",b."countNote" FROM "InventoryBalance" b JOIN "Product" p ON p.id=b."productId" JOIN "Warehouse" w ON w.id=b."warehouseId" WHERE w.code='WH-MAIN' AND b."lastCountedAt" IS NOT NULL ORDER BY p.sku;
