# Shopify OMS — stage 2: durable intake

## Implemented, not deployed

The three routes now use `webhook-runtime.ts` / `webhook-handler.ts` / `intake.ts`:

- orders/create → `/api/shopify/webhooks/orders-create`
- orders/paid → `/api/shopify/webhooks/orders-paid`
- orders/updated → `/api/shopify/webhooks/orders-updated`

All three save/upsert the same shop + external order ID. Paid/updated may recover a missed create event, but never approve or create a shipment. Signature, exact topic and mandatory configured myshopify.com domain are checked before persistence. Invalid JSON/missing or unsafe numeric order IDs return 400; malformed product data with a valid order ID is retained in the snapshot.

Order headers and a minimized complete list of Shopify line items are saved in one bounded transaction together with the webhook event. No Product lookup/creation or Customer creation occurs on this critical path; therefore an unknown SKU cannot reject the whole order. OrderItem rows are intentionally deferred until validated product mapping. Snapshot details and snapshot item counts are visible on the existing order detail/list pages.

Only allowlisted order fields are retained. Snapshot still contains personal shipping/contact data and must remain inside authenticated HQ. Never expose raw payload/event data in public responses.

Idempotency uses shop + topic + event ID (delivery ID/body hash fallback); PostgreSQL transaction advisory lock serializes all deliveries for one shop/order, including the first insert. Same-event/different-data conflicts fail explicitly. Source timestamps guard stale updates; equal/unknown source versions with different snapshots are quarantined rather than overwriting current payment data. Inbox retains the conflicting snapshot for future reconcile. `PROCESSED` here means durable intake completed, not product validation or fulfillment completed.

Every newly ingested order remains NEW with a blocking check-pending flag. No green approval is claimed. Refunds/cancellations remain blocked; already operational/shipped states and amounts are preserved while the latest incoming snapshot/payment state is recorded. Native legacy records without a known source version still require future reconciliation before their data can be trusted for fulfillment.

Old editing/payment/shipping-fee/status/approval actions reject OMS-enrolled orders. The transaction guard uses the same intake lock and re-reads enrollment, avoiding a check/write race. Shipment status actions also reject enrolled orders. These are intentionally conservative temporary gates until the dedicated review/fulfillment service is implemented, not the final READY workflow. Unenrolled non-Shopify orders keep the old workflow.

On success the route returns 200 only after commit. Notification/cache refresh runs separately with waitUntil and cannot turn a committed order into an intake error. A storage failure returns 503 for Shopify redelivery, with a best-effort FAILED inbox entry and a sanitized log code. If the DB is entirely unavailable, no durable error entry can be guaranteed. The transaction has a 2.5s timeout and 0.5s max wait; actual end-to-end latency has not been load-tested.

## Deliberately incomplete

- No mapping worker, full stock/temperature/gift check, dedicated approval action or READY → shipment action yet. All new orders are blocked, including correctly mapped products. Do not deploy this intermediate branch for production use.
- No admin Shopify API reconcile or scheduled retry worker. Failed intake relies on Shopify redelivery for now.
- Payload expiry is stored, but retention cleanup is not implemented. Intake must not be enabled in production before retention/access rules and cleanup are finalized.
- The initial legacy importer remains as unused compatibility code/tests; new HTTP routes no longer call it. Future reconcile must call the new intake pipeline, not the old SKU-dependent importer.
- Known subtotal/total money fields retain the existing Float model. Snapshot preserves original strings and currency; malformed amounts are quarantined with a 0 header placeholder and a blocking flag. Non-TWD data is flagged, not FX-converted. Existing aggregate reports must exclude/quarantine such rows before production rollout.
- Orders with cancelled status are in the existing history view. Dashboard counters, OMS filter tabs and normal review UI are not completed.
- No actual DB migration, backfill, Shopify subscription changes, carrier API calls, push to GitHub or Preview/production deployment.

## Verification

- 32 focused tests pass (OMS rules, existing Shopify helpers, HTTP boundary and new intake contract tests).
- In-memory transaction tests cover duplicate/concurrent calls, unknown SKU, paid/older unpaid sequence, conflicts, refunds, failure/retry and gate locking order. They are **not** PostgreSQL integration tests; real locks, unique constraints and transaction rollback must be tested in the isolated Preview DB.
- Full tsc still fails in existing unrelated test files, also reproduced on untouched base commit. Do not claim the project typecheck passes.
- Next lint prompts for initial ESLint configuration; no config was added and lint is not verified.
- Prisma Client generation and diff whitespace check pass. No build or browser visual acceptance has been run.

## Deployment prerequisites

The stage-1 migration is still required and unexecuted; there is no new schema migration in stage 2. Confirm the actual Cursor/Vercel deployment branch and isolated Preview DB before applying it. Do not redeploy directly against production or an unmigrated DB. Dedicated review, reconcile, regression fixes and real DB/visual tests must follow before offering a working Preview.

Reference for delivery validation, duplicate correlation and response timing: https://shopify.dev/docs/apps/build/webhooks/verify-deliveries
