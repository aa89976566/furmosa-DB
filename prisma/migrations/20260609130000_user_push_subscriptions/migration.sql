-- CreateTable
CREATE TABLE "user_push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_push_subscriptions_endpoint_key" ON "user_push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "user_push_subscriptions_user_id_idx" ON "user_push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "user_push_subscriptions" ADD CONSTRAINT "user_push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
