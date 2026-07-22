-- 柒沐寵物美容（MER-0014）：預設物流改為直接送貨，並寫入淡水店址
-- 地址來源：公司登記營業地址（新北市淡水區北新路218號）
-- 待出貨單收件資料由 runtime ensureQimuDeliveryShipping 補齊（避免 migrate 過重）

UPDATE "Merchant"
SET
  "preferredCarrier" = '送貨',
  "pickupStoreName" = NULL,
  "address" = '新北市淡水區北新路218號',
  "city" = COALESCE(NULLIF(BTRIM("city"), ''), '新北市淡水區'),
  "phone" = COALESCE(NULLIF(BTRIM("phone"), ''), '02-2628-3589'),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "merchantId" = 'MER-0014'
   OR "name" IN ('柒沐寵物美容', '柒木寵物美容', '淡水柒沐寵物美容', '淡水柒木寵物美容')
   OR ("name" LIKE '%柒沐%' AND "name" LIKE '%寵物美容%')
   OR ("name" LIKE '%柒木%' AND "name" LIKE '%寵物美容%');
