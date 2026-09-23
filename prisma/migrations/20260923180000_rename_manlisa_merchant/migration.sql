-- Correct the store name typo while preserving its merchant identity and history.
UPDATE "Merchant"
SET "name" = '曼莉莎寵物美容'
WHERE "name" = '曼利莎寵物美容';
