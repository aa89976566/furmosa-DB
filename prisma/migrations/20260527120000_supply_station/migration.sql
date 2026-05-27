-- CreateTable
CREATE TABLE "supply_members" (
    "id" TEXT NOT NULL,
    "member_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "customer_id" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "return_count" INTEGER NOT NULL DEFAULT 0,
    "last_activity_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "return_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unused',
    "member_id" TEXT,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "return_events" (
    "id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "code_id" TEXT NOT NULL,
    "points_earned" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_rewards" (
    "id" TEXT NOT NULL,
    "reward_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "points_cost" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supply_rewards_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supply_redemptions" (
    "id" TEXT NOT NULL,
    "redemption_code" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "points_used" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supply_redemptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supply_members_member_code_key" ON "supply_members"("member_code");
CREATE UNIQUE INDEX "supply_members_customer_id_key" ON "supply_members"("customer_id");
CREATE INDEX "supply_members_last_activity_at_idx" ON "supply_members"("last_activity_at");

CREATE UNIQUE INDEX "return_codes_code_key" ON "return_codes"("code");
CREATE INDEX "return_codes_status_idx" ON "return_codes"("status");
CREATE INDEX "return_codes_member_id_idx" ON "return_codes"("member_id");

CREATE UNIQUE INDEX "return_events_code_id_key" ON "return_events"("code_id");
CREATE INDEX "return_events_member_id_created_at_idx" ON "return_events"("member_id", "created_at");

CREATE UNIQUE INDEX "supply_rewards_reward_code_key" ON "supply_rewards"("reward_code");
CREATE INDEX "supply_rewards_status_idx" ON "supply_rewards"("status");

CREATE UNIQUE INDEX "supply_redemptions_redemption_code_key" ON "supply_redemptions"("redemption_code");
CREATE INDEX "supply_redemptions_member_id_idx" ON "supply_redemptions"("member_id");

ALTER TABLE "supply_members" ADD CONSTRAINT "supply_members_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_codes" ADD CONSTRAINT "return_codes_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "supply_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_events" ADD CONSTRAINT "return_events_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "supply_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_events" ADD CONSTRAINT "return_events_code_id_fkey" FOREIGN KEY ("code_id") REFERENCES "return_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supply_redemptions" ADD CONSTRAINT "supply_redemptions_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "supply_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supply_redemptions" ADD CONSTRAINT "supply_redemptions_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "supply_rewards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
