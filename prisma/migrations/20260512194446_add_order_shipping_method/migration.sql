-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cvsBrand" TEXT,
ADD COLUMN     "cvsStoreId" TEXT,
ADD COLUMN     "cvsStoreName" TEXT,
ADD COLUMN     "shippingMethod" TEXT NOT NULL DEFAULT 'home';
