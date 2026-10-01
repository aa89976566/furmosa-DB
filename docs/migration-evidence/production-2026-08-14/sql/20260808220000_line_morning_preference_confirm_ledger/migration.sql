-- Phase 4B-B CONSENSUS：Confirm ledger（additive only）
-- - 不修改 line_morning_preferences 既有列／預設值（alternate/off/unset 不變）
-- - 不改寫舊 migration
-- - rollback = DROP TABLE line_morning_preference_confirm_ledgers

CREATE TABLE "line_morning_preference_confirm_ledgers" (
    "id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "event_dedup_key" TEXT NOT NULL,
    "session_nonce_hash" TEXT NOT NULL,
    "step_version" INTEGER NOT NULL,
    "payload_digest" TEXT NOT NULL,
    "preference_snapshot" TEXT NOT NULL,
    "success_summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "line_morning_preference_confirm_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_morning_preference_confirm_ledgers_event_dedup_key_key"
  ON "line_morning_preference_confirm_ledgers"("event_dedup_key");

CREATE UNIQUE INDEX "line_morning_preference_confirm_ledgers_session_nonce_hash_payload_digest_key"
  ON "line_morning_preference_confirm_ledgers"("session_nonce_hash", "payload_digest");

CREATE INDEX "line_morning_preference_confirm_ledgers_line_user_id_created_at_idx"
  ON "line_morning_preference_confirm_ledgers"("line_user_id", "created_at");

CREATE INDEX "line_morning_preference_confirm_ledgers_session_nonce_hash_idx"
  ON "line_morning_preference_confirm_ledgers"("session_nonce_hash");
