-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "paymentType" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "Subscription" ADD COLUMN "paymentNote" TEXT;
