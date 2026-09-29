CREATE TABLE "automation_jobs" (
  "id" TEXT NOT NULL,
  "job_key" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "entity_type" TEXT,
  "entity_id" TEXT,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMP(3),
  "last_error" TEXT,
  "fallback_result" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "automation_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "automation_jobs_job_key_key" ON "automation_jobs"("job_key");
CREATE INDEX "automation_jobs_status_next_attempt_at_idx" ON "automation_jobs"("status", "next_attempt_at");
CREATE INDEX "automation_jobs_type_status_idx" ON "automation_jobs"("type", "status");
CREATE INDEX "automation_jobs_entity_type_entity_id_idx" ON "automation_jobs"("entity_type", "entity_id");
