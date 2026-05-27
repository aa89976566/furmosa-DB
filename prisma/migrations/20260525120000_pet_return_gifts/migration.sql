-- CreateTable
CREATE TABLE "pet_return_gifts" (
    "id" TEXT NOT NULL,
    "giftId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "pointsCost" INTEGER NOT NULL,
    "companyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shippingFeeType" TEXT NOT NULL DEFAULT 'free',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_return_gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pet_return_gift_redemptions" (
    "id" TEXT NOT NULL,
    "redemptionId" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "gift_id" TEXT NOT NULL,
    "points_used" INTEGER NOT NULL,
    "company_gift_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shipping_fee_type" TEXT NOT NULL DEFAULT 'free',
    "shipping_method" TEXT NOT NULL DEFAULT 'home',
    "shipping_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "company_shipping_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recipient_name" TEXT NOT NULL,
    "recipient_phone" TEXT,
    "shipping_address" TEXT,
    "cvs_brand" TEXT,
    "cvs_store_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "fulfilled_at" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_return_gift_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pet_return_gifts_giftId_key" ON "pet_return_gifts"("giftId");

-- CreateIndex
CREATE INDEX "pet_return_gifts_status_idx" ON "pet_return_gifts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "pet_return_gift_redemptions_redemptionId_key" ON "pet_return_gift_redemptions"("redemptionId");

-- CreateIndex
CREATE INDEX "pet_return_gift_redemptions_customer_id_idx" ON "pet_return_gift_redemptions"("customer_id");

-- CreateIndex
CREATE INDEX "pet_return_gift_redemptions_gift_id_idx" ON "pet_return_gift_redemptions"("gift_id");

-- CreateIndex
CREATE INDEX "pet_return_gift_redemptions_status_idx" ON "pet_return_gift_redemptions"("status");

-- AddForeignKey
ALTER TABLE "pet_return_gift_redemptions" ADD CONSTRAINT "pet_return_gift_redemptions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pet_return_gift_redemptions" ADD CONSTRAINT "pet_return_gift_redemptions_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "pet_return_gifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
