-- 匠寵換罐贈品目錄（LINE 兌換好康）
UPDATE reward_catalog
SET
  reward_name = '洗澡折 250',
  coupon_face_value = 250,
  updated_at = NOW()
WHERE reward_name ILIKE '%洗澡%';

UPDATE reward_catalog
SET
  reward_name = '免費 50g',
  points_required = 5,
  updated_at = NOW()
WHERE reward_name ILIKE '%50g%' OR reward_name ILIKE '%50G%';
