-- LINE 開戶：毛孩品種（手填）
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "pet_breed" TEXT;
