-- 既有 7-11 店家：address 與門市名稱同源，避免出貨／訂單帶入舊街址
UPDATE "Merchant"
SET
  "address" = '7-11 · ' || TRIM("pickupStoreName"),
  "updatedAt" = NOW()
WHERE "preferredCarrier" = '7-11'
  AND "pickupStoreName" IS NOT NULL
  AND TRIM("pickupStoreName") <> ''
  AND (
    "address" IS NULL
    OR TRIM("address") = ''
    OR "address" <> ('7-11 · ' || TRIM("pickupStoreName"))
  );

-- 既有超商取貨訂單：shippingAddress 與門市名稱同源
UPDATE "Order"
SET
  "shippingAddress" = CASE
    WHEN "cvsBrand" = '711' THEN '7-11 · ' || TRIM("cvsStoreName")
    WHEN "cvsBrand" = 'familymart' THEN '全家 · ' || TRIM("cvsStoreName")
    WHEN "cvsBrand" = 'hilife' THEN '萊爾富 · ' || TRIM("cvsStoreName")
    ELSE '超商 · ' || TRIM("cvsStoreName")
  END,
  "updatedAt" = NOW()
WHERE "shippingMethod" = 'convenience'
  AND "cvsStoreName" IS NOT NULL
  AND TRIM("cvsStoreName") <> ''
  AND (
    "shippingAddress" IS NULL
    OR TRIM("shippingAddress") = ''
    OR POSITION(TRIM("cvsStoreName") IN COALESCE("shippingAddress", '')) = 0
  );

-- 同步對應出貨單收件地址（客戶訂單）
UPDATE "Shipment" s
SET
  "recipientAddress" = o."shippingAddress",
  "updatedAt" = NOW()
FROM "Order" o
WHERE s."orderId" = o."id"
  AND o."shippingMethod" = 'convenience'
  AND o."cvsStoreName" IS NOT NULL
  AND TRIM(o."cvsStoreName") <> ''
  AND o."shippingAddress" IS NOT NULL
  AND (
    s."recipientAddress" IS NULL
    OR TRIM(s."recipientAddress") = ''
    OR POSITION(TRIM(o."cvsStoreName") IN COALESCE(s."recipientAddress", '')) = 0
  );
