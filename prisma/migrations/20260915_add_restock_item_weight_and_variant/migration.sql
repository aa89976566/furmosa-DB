-- 新增 RestockRequestItem 規格欄位
ALTER TABLE "restock_request_items" ADD COLUMN "weight_grams" INTEGER;
ALTER TABLE "restock_request_items" ADD COLUMN "variant_key" TEXT;

-- 新增註解
COMMENT ON COLUMN "restock_request_items"."weight_grams" IS '商品規格：克數（30/50/100 等）；無規格商品為 null';
COMMENT ON COLUMN "restock_request_items"."variant_key" IS '商品規格key（ProductPriceTier.id 或 "base"）；無規格商品為 null';

