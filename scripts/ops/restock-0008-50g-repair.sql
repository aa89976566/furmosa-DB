-- Run ONLY after additive schema migration and all four preflight rows are READY.
-- Does not create tiers, infer prices, post stock, change quantities or ship orders.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';
CREATE TEMP TABLE repair_expected(product_id text PRIMARY KEY, product_name text, quantity int) ON COMMIT DROP;
INSERT INTO repair_expected VALUES
 ('cmp2idsu60006qw9lwk1thk62','原味雞霸',4),
 ('cmp2iexrc0048qw9lvbcefax4','豬耳朵條',3),
 ('cmp2if15l004qqw9lm8jrd9ou','雞肉南瓜乾',3),
 ('cmp2iet8s003oqw9lu9jiraca','鴨喉嚨',4);
DO $$
DECLARE n int;
BEGIN
 PERFORM 1 FROM "Shipment" WHERE id='cmtudbjqc000e9i644e4htxy4' FOR UPDATE;
 PERFORM 1 FROM restock_requests WHERE id='cmtr4yv2n000110kn5gqwglf3' FOR UPDATE;
 PERFORM 1 FROM "ShipmentItem" WHERE "shipmentId"='cmtudbjqc000e9i644e4htxy4' FOR UPDATE;
 PERFORM 1 FROM restock_request_items WHERE restock_request_id='cmtr4yv2n000110kn5gqwglf3' FOR UPDATE;
 PERFORM 1 FROM "OrderItem" WHERE "orderId"='cmtudbj1b00079i64wr978h73' FOR UPDATE;
 PERFORM 1 FROM "ProductPriceTier" WHERE "productId" IN (SELECT product_id FROM repair_expected) FOR SHARE;
 SELECT count(*) INTO n FROM "Shipment" s JOIN "Merchant" m ON m.id=s."merchantId"
 JOIN restock_requests r ON r.shipment_id=s.id AND r.merchant_id=m.id
 JOIN "Order" o ON o.id=s."orderId" AND o."merchantId"=m.id
 WHERE s.id='cmtudbjqc000e9i644e4htxy4' AND s."shipmentNumber"='SHP-202609-0008'
 AND s.type='merchant_restock' AND s.status='pending' AND s."stockPostedAt" IS NULL
 AND m.id='cmp2idqtk0003qw9lhd4mpk61' AND m.name='泡泡堂'
 AND r.id='cmtr4yv2n000110kn5gqwglf3' AND r.status='converted_to_shipment'
 AND o.id='cmtudbj1b00079i64wr978h73';
 IF n<>1 THEN RAISE EXCEPTION 'STOP: target identity or workflow changed'; END IF;
 IF EXISTS(SELECT 1 FROM repair_expected e WHERE (SELECT count(*) FROM "ProductPriceTier" t WHERE t."productId"=e.product_id AND t."weightGrams"=50)<>1)
 THEN RAISE EXCEPTION 'STOP: each product must have exactly one real 50g ProductPriceTier'; END IF;
 IF (SELECT count(*) FROM "ShipmentItem" WHERE "shipmentId"='cmtudbjqc000e9i644e4htxy4')<>4
 OR (SELECT count(*) FROM restock_request_items WHERE restock_request_id='cmtr4yv2n000110kn5gqwglf3')<>4
 OR (SELECT count(*) FROM "OrderItem" WHERE "orderId"='cmtudbj1b00079i64wr978h73')<>4
 THEN RAISE EXCEPTION 'STOP: target must have exactly four items in every layer'; END IF;
 SELECT count(DISTINCT e.product_id) INTO n FROM repair_expected e
 JOIN "ShipmentItem" si ON si."shipmentId"='cmtudbjqc000e9i644e4htxy4' AND si."productId"=e.product_id AND si."productName"=e.product_name AND si.quantity=e.quantity
 JOIN restock_request_items ri ON ri.restock_request_id='cmtr4yv2n000110kn5gqwglf3' AND ri.product_id=e.product_id AND ri.requested_quantity=e.quantity AND ri.approved_quantity=e.quantity
 JOIN "OrderItem" oi ON oi."orderId"='cmtudbj1b00079i64wr978h73' AND oi."productId"=e.product_id AND oi."productName"=e.product_name AND oi.quantity=e.quantity
 WHERE (si."weightGrams" IS NULL OR si."weightGrams"=50) AND (ri.weight_grams IS NULL OR ri.weight_grams=50) AND (oi."weightGrams" IS NULL OR oi."weightGrams"=50);
 IF n<>4 THEN RAISE EXCEPTION 'STOP: product, quantity, or prior weight mismatch'; END IF;
 IF EXISTS(SELECT 1 FROM "MerchantStockTxn" WHERE "shipmentItemId" IN (SELECT id FROM "ShipmentItem" WHERE "shipmentId"='cmtudbjqc000e9i644e4htxy4') OR ("merchantId"='cmp2idqtk0003qw9lhd4mpk61' AND note LIKE '%SHP-202609-0008%'))
 THEN RAISE EXCEPTION 'STOP: inventory already posted; manual reconciliation required'; END IF;
 SELECT count(DISTINCT e.product_id) INTO n FROM restock_requests r CROSS JOIN LATERAL jsonb_array_elements(r.approved_snapshot) a
 JOIN repair_expected e ON a->>'productId'=e.product_id AND a->>'productName'=e.product_name AND (a->>'quantity')::int=e.quantity
 WHERE r.id='cmtr4yv2n000110kn5gqwglf3' AND jsonb_array_length(r.approved_snapshot)=4;
 IF n<>4 THEN RAISE EXCEPTION 'STOP: approval snapshot mismatch'; END IF;
END $$;
CREATE TEMP TABLE repair_tiers ON COMMIT DROP AS SELECT e.*,t.id AS tier_id FROM repair_expected e JOIN "ProductPriceTier" t ON t."productId"=e.product_id AND t."weightGrams"=50;
-- Preserve full before-images for verification within this transaction.
CREATE TEMP TABLE repair_stock_before ON COMMIT DROP AS SELECT * FROM "MerchantStock" WHERE "merchantId"='cmp2idqtk0003qw9lhd4mpk61';
UPDATE restock_request_items ri SET weight_grams=50,variant_key=t.tier_id FROM repair_tiers t WHERE ri.restock_request_id='cmtr4yv2n000110kn5gqwglf3' AND ri.product_id=t.product_id;
UPDATE "ShipmentItem" si SET "weightGrams"=50,"variantKey"=t.tier_id FROM repair_tiers t WHERE si."shipmentId"='cmtudbjqc000e9i644e4htxy4' AND si."productId"=t.product_id;
UPDATE "OrderItem" oi SET "weightGrams"=50 FROM repair_tiers t WHERE oi."orderId"='cmtudbj1b00079i64wr978h73' AND oi."productId"=t.product_id;
UPDATE restock_requests r SET approved_snapshot=(SELECT jsonb_agg(a.value || jsonb_build_object('weightGrams',50,'variantKey',t.tier_id) ORDER BY a.ordinality) FROM jsonb_array_elements(r.approved_snapshot) WITH ORDINALITY a JOIN repair_tiers t ON t.product_id=a.value->>'productId') WHERE r.id='cmtr4yv2n000110kn5gqwglf3';
DO $$
DECLARE n int;
BEGIN
 SELECT count(*) INTO n FROM repair_tiers t
 JOIN restock_request_items ri ON ri.restock_request_id='cmtr4yv2n000110kn5gqwglf3' AND ri.product_id=t.product_id AND ri.weight_grams=50 AND ri.variant_key=t.tier_id AND ri.requested_quantity=t.quantity AND ri.approved_quantity=t.quantity
 JOIN "ShipmentItem" si ON si."shipmentId"='cmtudbjqc000e9i644e4htxy4' AND si."productId"=t.product_id AND si."weightGrams"=50 AND si."variantKey"=t.tier_id AND si.quantity=t.quantity
 JOIN "OrderItem" oi ON oi."orderId"='cmtudbj1b00079i64wr978h73' AND oi."productId"=t.product_id AND oi."weightGrams"=50 AND oi.quantity=t.quantity;
 IF n<>4 THEN RAISE EXCEPTION 'STOP: post-update verification failed'; END IF;
 IF EXISTS((SELECT * FROM repair_stock_before EXCEPT SELECT * FROM "MerchantStock" WHERE "merchantId"='cmp2idqtk0003qw9lhd4mpk61') UNION ALL (SELECT * FROM "MerchantStock" WHERE "merchantId"='cmp2idqtk0003qw9lhd4mpk61' EXCEPT SELECT * FROM repair_stock_before))
 THEN RAISE EXCEPTION 'STOP: stock changed'; END IF;
END $$;
COMMIT;
