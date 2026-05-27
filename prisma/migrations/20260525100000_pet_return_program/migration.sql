-- CreateTable
CREATE TABLE "redeem_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_used" BOOLEAN NOT NULL DEFAULT false,
    "used_by_user_id" TEXT,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redeem_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_points" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "redeem_codes_code_key" ON "redeem_codes"("code");

-- CreateIndex
CREATE INDEX "redeem_codes_is_used_idx" ON "redeem_codes"("is_used");

-- CreateIndex
CREATE INDEX "redeem_codes_used_by_user_id_idx" ON "redeem_codes"("used_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_points_user_id_key" ON "user_points"("user_id");

-- AddForeignKey
ALTER TABLE "redeem_codes" ADD CONSTRAINT "redeem_codes_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_points" ADD CONSTRAINT "user_points_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
