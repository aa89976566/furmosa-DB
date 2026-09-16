-- One-time operations cleanup requested on 2026-09-16.
-- Cancel the six UGC applications that were pending review at the time of the request.
-- Keep the applications and their audit trail; do not send customer notifications.

INSERT INTO "status_audit_logs" (
  "id",
  "entity_type",
  "entity_id",
  "previous_status",
  "new_status",
  "actor_type",
  "actor_id",
  "metadata_json",
  "application_id"
)
SELECT
  'ugc-cancel-20260916-' || app."id",
  'campaign_application',
  app."id",
  app."status",
  'CANCELLED',
  'supervisor',
  'operations',
  '{"reason":"2026-09-16 管理端批次取消 UGC 待審核申請","customerNotified":false}',
  app."id"
FROM "campaign_applications" AS app
WHERE app."id" IN (
  'cmt6xa5ks000481ybekx4o7vy',
  'cmsypevzn0004omp778pttz4y',
  'cmsymjzch000413fqoaxey5z4',
  'cmsyg1njt0004wiyqxhryhmvy',
  'cmsy6yvw80006yqj7xowhrq4b',
  'cmsxc41x40003m7vodra4tm0e'
)
  AND app."status" = 'PENDING_REVIEW'
ON CONFLICT ("id") DO NOTHING;

UPDATE "Order"
SET
  "status" = 'cancelled',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN (
  SELECT "order_id"
  FROM "campaign_applications"
  WHERE "id" IN (
    'cmt6xa5ks000481ybekx4o7vy',
    'cmsypevzn0004omp778pttz4y',
    'cmsymjzch000413fqoaxey5z4',
    'cmsyg1njt0004wiyqxhryhmvy',
    'cmsy6yvw80006yqj7xowhrq4b',
    'cmsxc41x40003m7vodra4tm0e'
  )
    AND "status" = 'PENDING_REVIEW'
    AND "order_id" IS NOT NULL
);

UPDATE "conversation_sessions"
SET
  "current_state" = 'CANCELLED',
  "completed_at" = COALESCE("completed_at", CURRENT_TIMESTAMP),
  "updated_at" = CURRENT_TIMESTAMP
WHERE "campaign_application_id" IN (
  SELECT "id"
  FROM "campaign_applications"
  WHERE "id" IN (
    'cmt6xa5ks000481ybekx4o7vy',
    'cmsypevzn0004omp778pttz4y',
    'cmsymjzch000413fqoaxey5z4',
    'cmsyg1njt0004wiyqxhryhmvy',
    'cmsy6yvw80006yqj7xowhrq4b',
    'cmsxc41x40003m7vodra4tm0e'
  )
    AND "status" = 'PENDING_REVIEW'
);

UPDATE "campaign_applications"
SET
  "status" = 'CANCELLED',
  "shipping_queue_status" = 'NOT_READY',
  "reviewed_by" = 'operations',
  "reviewed_at" = CURRENT_TIMESTAMP,
  "review_note" = '2026-09-16 管理端批次取消 UGC 待審核申請',
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" IN (
  'cmt6xa5ks000481ybekx4o7vy',
  'cmsypevzn0004omp778pttz4y',
  'cmsymjzch000413fqoaxey5z4',
  'cmsyg1njt0004wiyqxhryhmvy',
  'cmsy6yvw80006yqj7xowhrq4b',
  'cmsxc41x40003m7vodra4tm0e'
)
  AND "status" = 'PENDING_REVIEW';
