-- Phase 4B-C CONSENSUS：每日 morning plan ledger（additive only）
-- - 不修改 line_morning_preferences / confirm_ledgers / deliveries 既有列
-- - alternate/off/unset 資料不變
-- - rollback = DROP TABLE line_morning_plan_ledgers

CREATE TABLE "line_morning_plan_ledgers" (
    "id" TEXT NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "run_date" TEXT NOT NULL,
    "content_id" TEXT,
    "content_type" TEXT,
    "decision_reason" TEXT NOT NULL,
    "plan_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "line_morning_plan_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "line_morning_plan_ledgers_run_date_line_user_id_key"
  ON "line_morning_plan_ledgers"("run_date", "line_user_id");

CREATE INDEX "line_morning_plan_ledgers_run_date_plan_status_idx"
  ON "line_morning_plan_ledgers"("run_date", "plan_status");

CREATE INDEX "line_morning_plan_ledgers_line_user_id_created_at_idx"
  ON "line_morning_plan_ledgers"("line_user_id", "created_at");
