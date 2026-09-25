-- 統一曼莉莎寵物美容在合作店與店家主資料的顯示名稱。
-- 保留 slug、MER 編號及所有現有關聯，不影響會員、庫存或序號。
UPDATE "stores"
SET "name" = '曼莉莎寵物美容',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" = 'manlisa'
   OR "name" = '曼利莎寵物美容';

UPDATE "Merchant"
SET "name" = '曼莉莎寵物美容',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "merchantId" = 'MER-0017'
   OR "name" = '曼利莎寵物美容';
