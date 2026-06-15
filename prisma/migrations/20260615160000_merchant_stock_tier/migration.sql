-- AlterTable
ALTER TABLE "MerchantStock" ADD COLUMN "tierId" TEXT NOT NULL DEFAULT '';

-- DropIndex
DROP INDEX "MerchantStock_merchantId_productId_key";

-- CreateIndex
CREATE UNIQUE INDEX "MerchantStock_merchantId_productId_tierId_key" ON "MerchantStock"("merchantId", "productId", "tierId");
