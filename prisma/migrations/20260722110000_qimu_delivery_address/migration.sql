-- 柒沐寵物美容（MER-0014）：預設物流改為直接送貨，並寫入淡水店址
-- 地址來源：公司登記營業地址（新北市淡水區北新路218號）

UPDATE "Merchant"
SET
  "preferredCarrier" = '送貨',
  "pickupStoreName" = NULL,
  "address" = '新北市淡水區北新路218號',
  "city" = COALESCE(NULLIF(TRIM("city"), ''), '新北市淡水區'),
  "phone" = COALESCE(NULLIF(TRIM("phone"), ''), '02-2628-3589'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "merchantId" = 'MER-0014'
   OR "name" IN ('柒沐寵物美容', '柒木寵物美容', '淡水柒沐寵物美容', '淡水柒木寵物美容')
   OR ("name" LIKE '%柒沐%' AND "name" LIKE '%寵物美容%')
   OR ("name" LIKE '%柒木%' AND "name" LIKE '%寵物美容%');

-- 待出貨的寄賣進貨單一併改為送貨，並補上收件地址
UPDATE "Shipment" s
SET
  "carrier" = '送貨',
  "recipientAddress" = COALESCE(
    NULLIF(TRIM(s."recipientAddress"), ''),
    '新北市淡水區北新路218號'
  ),
  "recipientName" = COALESCE(
    NULLIF(TRIM(s."recipientName"), ''),
    NULLIF(TRIM(m."contactName"), ''),
    m."name"
  ),
  "recipientPhone" = COALESCE(
    NULLIF(TRIM(s."recipientPhone"), ''),
    NULLIF(TRIM(m."phone"), ''),
    '02-2628-3589'
  ),
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Merchant" m
WHERE s."merchantId" = m."id"
  AND (
    m."merchantId" = 'MER-0014'
    OR m."name" IN ('柒沐寵物美容', '柒木寵物美容', '淡水柒沐寵物美容', '淡水柒木寵物美容')
    OR (m."name" LIKE '%柒沐%' AND m."name" LIKE '%寵物美容%')
    OR (m."name" LIKE '%柒木%' AND m."name" LIKE '%寵物美容%')
  )
  AND s."type" = 'merchant_restock'
  AND s."status" IN ('pending', 'packed');

-- 關聯寄賣進貨訂單的送貨方式／地址一併補齊
UPDATE "Order" o
SET
  "shippingMethod" = 'delivery',
  "shippingAddress" = COALESCE(
    NULLIF(TRIM(o."shippingAddress"), ''),
    '新北市淡水區北新路218號'
  ),
  "cvsStoreName" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Shipment" s
JOIN "Merchant" m ON s."merchantId" = m."id"
WHERE o."id" = s."orderId"
  AND s."type" = 'merchant_restock'
  AND s."status" IN ('pending', 'packed')
  AND (
    m."merchantId" = 'MER-0014'
    OR m."name" IN ('柒沐寵物美容', '柒木寵物美容', '淡水柒沐寵物美容', '淡水柒木寵物美容')
    OR (m."name" LIKE '%柒沐%' AND m."name" LIKE '%寵物美容%')
    OR (m."name" LIKE '%柒木%' AND m."name" LIKE '%寵物美容%')
  );
