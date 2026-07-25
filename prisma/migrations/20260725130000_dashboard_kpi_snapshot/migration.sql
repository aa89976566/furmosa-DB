-- Dashboard KPI 預聚合快照（單列 upsert）
CREATE TABLE IF NOT EXISTS "DashboardKpiSnapshot" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "payload" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardKpiSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DashboardKpiSnapshot_computedAt_idx" ON "DashboardKpiSnapshot"("computedAt");
