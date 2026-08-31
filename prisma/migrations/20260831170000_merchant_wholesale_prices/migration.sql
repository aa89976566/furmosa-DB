-- CreateTable
CREATE TABLE IF NOT EXISTS "MerchantWholesalePrice" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantKey" TEXT NOT NULL DEFAULT 'base',
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MerchantWholesalePrice_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MerchantWholesalePrice_unitPrice_check" CHECK ("unitPrice" > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "MerchantWholesalePrice_merchantId_productId_variantKey_key"
ON "MerchantWholesalePrice"("merchantId", "productId", "variantKey");

CREATE INDEX IF NOT EXISTS "MerchantWholesalePrice_merchantId_idx"
ON "MerchantWholesalePrice"("merchantId");

CREATE INDEX IF NOT EXISTS "MerchantWholesalePrice_productId_idx"
ON "MerchantWholesalePrice"("productId");

DO $$ BEGIN
  ALTER TABLE "MerchantWholesalePrice"
  ADD CONSTRAINT "MerchantWholesalePrice_merchantId_fkey"
  FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MerchantWholesalePrice"
  ADD CONSTRAINT "MerchantWholesalePrice_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
