-- Read only. Exact September shipment, exact merchant, exact four product IDs.
WITH expected(product_id, product_name, quantity) AS (VALUES
 ('cmp2idsu60006qw9lwk1thk62','原味雞霸',4),
 ('cmp2iexrc0048qw9lvbcefax4','豬耳朵條',3),
 ('cmp2if15l004qqw9lm8jrd9ou','雞肉南瓜乾',3),
 ('cmp2iet8s003oqw9lu9jiraca','鴨喉嚨',4)
)
SELECT e.product_name, e.quantity, si."weightGrams" AS shipment_weight,
       rri.requested_quantity, rri.approved_quantity,
       count(t.id) AS matching_confirmed_tiers,
       CASE WHEN count(t.id)=1 THEN 'READY' ELSE 'BLOCKED: unique 50g tier required' END AS result
FROM expected e
JOIN "Shipment" s ON s.id='cmtudbjqc000e9i644e4htxy4'
 AND s."shipmentNumber"='SHP-202609-0008' AND s.type='merchant_restock'
 AND s."merchantId"='cmp2idqtk0003qw9lhd4mpk61'
JOIN "Merchant" m ON m.id=s."merchantId" AND m.name='泡泡堂'
JOIN "ShipmentItem" si ON si."shipmentId"=s.id AND si."productId"=e.product_id
 AND si."productName"=e.product_name AND si.quantity=e.quantity
JOIN restock_requests r ON r.id='cmtr4yv2n000110kn5gqwglf3' AND r.shipment_id=s.id AND r.merchant_id=m.id
JOIN restock_request_items rri ON rri.restock_request_id=r.id AND rri.product_id=e.product_id
LEFT JOIN "ProductPriceTier" t ON t."productId"=e.product_id AND (t."weightGrams"=50 OR (t.id='cmpo2s6r6001hoseb1o5evkd8' AND t."weightGrams" IS NULL AND t.unit='片' AND t."unitQty"=1 AND t.price=89 AND t.cost=40))
GROUP BY e.product_name,e.quantity,si."weightGrams",rri.requested_quantity,rri.approved_quantity;
