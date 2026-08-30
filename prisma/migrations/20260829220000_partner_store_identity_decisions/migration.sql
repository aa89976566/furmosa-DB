-- 店家身分人工確認／測試標記。只建表，不寫入任何確認列。
CREATE TABLE "partner_store_identity_decisions" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "legacy_slug" TEXT,
    "verdict" TEXT NOT NULL,
    "decided_by_user_id" TEXT NOT NULL,
    "decided_at" TIMESTAMP(3) NOT NULL,
    "rationale" TEXT NOT NULL,
    "other_record_disposition" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'production',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_by_user_id" TEXT,
    "revoke_reason" TEXT,

    CONSTRAINT "partner_store_identity_decisions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partner_store_identity_decisions_scope_revoked_at_idx"
ON "partner_store_identity_decisions"("scope", "revoked_at");

CREATE INDEX "partner_store_identity_decisions_merchant_id_scope_idx"
ON "partner_store_identity_decisions"("merchant_id", "scope");

CREATE INDEX "partner_store_identity_decisions_legacy_slug_scope_idx"
ON "partner_store_identity_decisions"("legacy_slug", "scope");

CREATE UNIQUE INDEX "partner_store_identity_decisions_active_merchant_scope"
ON "partner_store_identity_decisions"("merchant_id", "scope")
WHERE "revoked_at" IS NULL;

CREATE UNIQUE INDEX "partner_store_identity_decisions_active_slug_scope"
ON "partner_store_identity_decisions"("legacy_slug", "scope")
WHERE "revoked_at" IS NULL AND "legacy_slug" IS NOT NULL;

ALTER TABLE "partner_store_identity_decisions"
ADD CONSTRAINT "partner_store_identity_decisions_decided_by_user_id_fkey"
FOREIGN KEY ("decided_by_user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "partner_store_identity_decisions"
ADD CONSTRAINT "partner_store_identity_decisions_revoked_by_user_id_fkey"
FOREIGN KEY ("revoked_by_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
