# Shopify OMS foundation — 2026-08-30

Historical stage-1 record. Stage 2 now wires durable intake and conservative legacy-action blocking; see `SHOPIFY-OMS-INTAKE.md` for the current implementation and remaining limitations.

## Scope / 現況

This is stage 1 only: an additive data model and pure validation helpers. The webhook receiver, worker, reconcile route, approval action, shipment gate and UI have **not** been connected to these fields yet. Existing order behavior is unchanged. Do not present this branch as a working OMS or deploy it for staff acceptance yet.

Base commit: `5996fa00371018037e48033fd85a4badf00042a0`.
Local branch: `codex/shopify-oms-foundation-20260830`.
No production writes, migration execution, backfill, push or deployment performed.

## Data model

- Order.omsStatus is nullable, without a default. Non-Shopify and existing orders remain unenrolled. Existing status/paymentStatus/fulfillmentStatus and monetary fields are untouched.
- omsIssueFlags: null means unchecked; [] means no issues after checking. Consumers must also inspect omsCheckedAt. Shape and allowed codes live in lib/orders/oms.ts. Malformed JSON fails closed.
- omsCheckedSourceUpdatedAt records the source version actually checked, separate from shopifySourceUpdatedAt. A newer source snapshot invalidates prior checks. Timestamps alone are insufficient to resolve different payloads with equal source timestamps: the future importer must compare payload hashes and reconcile conflicts, not arbitrarily overwrite.
- shopifySnapshot will retain a versioned, minimized Shopify order snapshot including unknown line items. This stage only adds the storage column; snapshot validation and import mapping remain to implement.
- omsReviewedById references HQ User, with ON DELETE SET NULL. Keep the durable review history in existing StatusAuditLog when wiring approval; never treat only the nullable reviewer FK as proof of prior approval.
- ShopifyWebhookEvent deduplicates by shopDomain + topic + eventId. Future ingestion must validate signature/domain/topic before persisting; use a stable documented fallback if an event ID is absent. External order IDs remain strings.
- Event processing status, attempts, lease, next attempt, expiry and error-code fields are storage foundations only, not a working retry system. Only sanitized codes belong in lastErrorCode.
- Snapshot/payload can contain customer personal information. Before enabling ingestion, define minimization and retention, restrict HQ roles, and prohibit public/raw payload responses. Never store credentials in payloads. Expiry indexes do not execute deletion automatically.

## Deployment and compatibility

The migration is additive, with no UPDATE/backfill or destructive statements. Existing OrderItem.productId remains required; do not create fake Products just to import unknown SKU lines. A future importer will first store the complete snapshot, then create mapped items, and block approval until all required lines are mapped.

Although old data defaults stay compatible, Prisma generated against the new schema can select the added fields on existing queries. **Deploying this schema without applying the migration to the target DB may break pages.** Do not redeploy this branch against an unmigrated or production-shared Preview database.

Before any migration/deployment:

1. Verify actual Cursor checkout, Vercel production source SHA/branch and Preview overrides.
2. Confirm isolated Preview DB and test-only Shopify/notification/provider configuration. Existing read-page maintenance code can write data, so merely visiting Preview is not necessarily read-only.
3. Obtain approval to run the migration in that isolated DB; test schema, constraints and concurrent ingestion there.
4. Connect and test the actual worker, unknown-item import, admin reconcile, authorized manual approval and shipment gate before acceptance.

Existing Shopify orders need an explicit later backfill. Shipped/cancelled/refunded orders must not be blindly reset to NEW/REVIEW or generate another Shipment. This migration deliberately does not infer old review history.

Rollback: roll application code back while retaining additive columns/table. Do not drop received events or snapshots. Any destructive schema rollback requires a separate backup and approval.

## Verification

- Seven focused tests in lib/orders/__tests__/oms.test.ts pass without a database.
- Prisma 5.22.0 validate passes with dummy loopback connection strings, without connecting.
- Offline schema-to-schema migrate diff matches the migration's added columns, enums, table, indexes and foreign key. No migration was applied; this does not validate production migration history/drift or execute SQL against PostgreSQL.
- git diff --check passes.
- No full-app build or DB integration tests run. Runtime dependencies/lockfile are unchanged.

The helper omsApprovalBlockers is not an authorization boundary by itself. When integrating it, load trusted HQ permissions and order data server-side and check/transition under a database transaction with concurrency control; never accept actorCanReview or a clean flag list from the browser.
