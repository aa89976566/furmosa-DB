-- 客戶毛孩檔案（選填）
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "pet_species" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "pet_species_other" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "pet_name" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "pet_age_years" INTEGER;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "pet_birthday" TIMESTAMP(3);
