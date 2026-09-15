-- 精準修正補貨單 0008 的規格為 50g
-- 條件檢驗 (必須全部滿足,否則 ROLLBACK):
-- 1. 泡泡堂店家(merchant name = '泡泡堂')
-- 2. shipmentNumber 當月 0008 (SHP-YYYYMM-0008 格式)
-- 3. 四個品項品名與數量完全吻合:
--    - 原味雞霸 ×4
--    - 豬耳朵條 ×3  
--    - 雞肉南瓜乾 ×3
--    - 鴨喉嚨 ×4
-- 4. 相關 RestockRequest & RestockRequestItem 存在
-- 5. 對應 MerchantStock/MerchantStockTxn (若有)
-- 全部條件檢驗失敗時置換失敗且不修改資料

BEGIN;

-- Step 1: 驗證數據完整性 - 建立臨時檢驗表
CREATE TEMP TABLE validation_checks AS
WITH merchant_check AS (
  SELECT 
    id as merchant_id,
    name as merchant_name,
    CASE WHEN name = '泡泡堂' THEN 1 ELSE 0 END as is_bubbletea
  FROM merchants
  WHERE name = '泡泡堂'
),
shipment_check AS (
  SELECT 
    s.id as shipment_id,
    s.shipment_number,
    s.merchant_id,
    m.id as merchant_id_verify,
    CASE 
      WHEN s.shipment_number ~ '^SHP-\d{6}-0008$' THEN 1 
      ELSE 0 
    END as is_valid_shipment_number
  FROM shipments s
  LEFT JOIN merchants m ON s.merchant_id = m.id
  WHERE s.shipment_number LIKE '%0008'
    AND s.type = 'merchant_restock'
),
items_count AS (
  SELECT 
    s.id as shipment_id,
    COUNT(*) as item_count
  FROM shipments s
  LEFT JOIN shipment_items si ON s.id = si.shipment_id
  WHERE s.shipment_number LIKE '%0008'
    AND s.type = 'merchant_restock'
  GROUP BY s.id
)
SELECT 
  CASE 
    WHEN m.is_bubbletea = 0 THEN 'FAIL: 店家不是泡泡堂'
    WHEN s.is_valid_shipment_number = 0 THEN 'FAIL: 補貨單編號格式不正確(應為 SHP-YYYYMM-0008)'
    WHEN ic.item_count != 4 THEN 'FAIL: 品項數不等於 4 個'
    ELSE 'OK'
  END as validation_status,
  m.merchant_name,
  s.shipment_number,
  ic.item_count,
  s.shipment_id
FROM merchant_check m
CROSS JOIN shipment_check s
LEFT JOIN items_count ic ON s.shipment_id = ic.shipment_id;

-- Step 2: 驗證四個品項名稱與數量 (只允許精準吻合)
CREATE TEMP TABLE items_validation AS
SELECT 
  si.id as shipment_item_id,
  si.shipment_id,
  si.product_name,
  si.quantity,
  CASE 
    WHEN si.product_name = '原味雞霸' AND si.quantity = 4 THEN '原味雞霸 ✓'
    WHEN si.product_name = '豬耳朵條' AND si.quantity = 3 THEN '豬耳朵條 ✓'
    WHEN si.product_name = '雞肉南瓜乾' AND si.quantity = 3 THEN '雞肉南瓜乾 ✓'
    WHEN si.product_name = '鴨喉嚨' AND si.quantity = 4 THEN '鴨喉嚨 ✓'
    ELSE '不符合規格'
  END as match_result
FROM shipment_items si
JOIN shipments s ON si.shipment_id = s.id
WHERE s.shipment_number LIKE '%0008'
  AND s.type = 'merchant_restock';

-- Step 3: 檢驗所有四個品項都完全吻合
DO $$
DECLARE
  v_match_count INTEGER;
  v_total_items INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_match_count
  FROM items_validation
  WHERE match_result LIKE '%✓';
  
  SELECT COUNT(*) INTO v_total_items
  FROM items_validation;
  
  IF v_match_count != 4 OR v_total_items != 4 THEN
    RAISE EXCEPTION 'VALIDATION_FAILED: 品項名稱或數量不符合 0008 補貨單規格 (找到 % / % 吻合)', v_match_count, v_total_items;
  END IF;
END
$$;

-- Step 4: 如果所有驗證通過,進行實際修改
-- 4a. 更新 RestockRequestItem 的 weightGrams = 50
UPDATE restock_request_items rri
SET weight_grams = 50,
    updated_at = NOW()
WHERE rri.restock_request_id IN (
  SELECT sr.id
  FROM restock_requests sr
  JOIN shipments s ON sr.shipment_id = s.id
  WHERE s.shipment_number LIKE '%0008'
    AND s.type = 'merchant_restock'
    AND sr.merchant_id IN (
      SELECT id FROM merchants WHERE name = '泡泡堂'
    )
)
AND rri.product_id IN (
  SELECT p.id
  FROM products p
  WHERE p.name IN ('原味雞霸', '豬耳朵條', '雞肉南瓜乾', '鴨喉嚨')
);

-- 4b. 更新 ShipmentItem 的 weightGrams = 50
UPDATE shipment_items si
SET weight_grams = 50,
    updated_at = NOW()
WHERE si.shipment_id IN (
  SELECT s.id
  FROM shipments s
  WHERE s.shipment_number LIKE '%0008'
    AND s.type = 'merchant_restock'
    AND s.merchant_id IN (
      SELECT id FROM merchants WHERE name = '泡泡堂'
    )
)
AND si.product_name IN ('原味雞霸', '豬耳朵條', '雞肉南瓜乾', '鴨喉嚨');

-- Step 5: 驗證修改成功
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM shipment_items si
  JOIN shipments s ON si.shipment_id = s.id
  WHERE s.shipment_number LIKE '%0008'
    AND s.type = 'merchant_restock'
    AND si.weight_grams = 50
    AND si.product_name IN ('原味雞霸', '豬耳朵條', '雞肉南瓜乾', '鴨喉嚨');
  
  IF v_updated_count != 4 THEN
    RAISE EXCEPTION 'UPDATE_FAILED: 僅修改了 % 個品項 (應為 4)', v_updated_count;
  END IF;
END
$$;

COMMIT;

-- 如發生任何例外,整個 transaction 會自動 ROLLBACK

