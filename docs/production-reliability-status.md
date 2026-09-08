# Production Reliability — 2026-09-08

Status: **CURRENT HEALTH CONTRACT ALIGNED**. The canonical public production health endpoint is `/api/health` only. The DB-backed public readiness experiment from PR #188 is historical and was superseded by the #201/#204 security hardening.

## Verified work

- `/api/health` is intentionally public liveness only: no auth, DB, Prisma, env or network access.
- PR #204 removed the public DB-backed `/api/health/ready` route and narrowed the middleware exemption to exact `/api/health`.
- Railway production uses `healthcheckPath=/api/health` with a 60-second timeout. Railway healthchecks gate deployments by requiring a successful 2xx response before traffic is switched: https://docs.railway.com/deployments/healthchecks
- Railway `source.checkSuites` is enabled for the production service.
- Production smoke covers `/api/health`, `/login`, `/pos/login`, expected unauthenticated redirects for `/orders` and `/pos`, and the 401 authorization gate for `/api/merchant/refill-orders`. This does not verify authenticated business reads.
- The smoke script uses only fixed audited GET routes, never follows redirects, never sends sessions and never records response bodies or exception contents.

## Platform blockers / guardrails

1. `main` branch protection is not currently enforced by GitHub. Keep CI as a merge gate for automated reliability fixes and do not merge a failing PR.
2. Railway `source.checkSuites` is enabled; preserve it.
3. Railway currently has pre-existing staged changes. Inspect their exact scope before accepting any environment-level staged deploy; do not commit unknown staged changes as part of an incident fix.
4. Keep the Railway platform probe at `/api/health`. Do not attach `/api/health/live` or `/api/health/ready`, and do not add a public DB query to satisfy deployment readiness.
5. Main may change concurrently. Refresh main/head SHAs and CI state immediately before merge.

## Remaining phases

- Phase 2: maintain platform gating and verify rollback availability. Public DB readiness is intentionally out of scope unless a future authoritative protected operator path is designed.
- Phase 4: authenticated POS and order read verification still requires an existing authorized test/session path that does not create or mutate business data.
- Phase 5: idempotency audit remains incomplete. Confirmed areas requiring separate evidence before changes include coupon verify-then-update atomicity, point-ledger locking across callers, and POS quantity correction plus audit-record transaction boundaries. Existing refill-order idempotency and Shopify event deduplication must be preserved.
- Phase 6: process crash retry is bounded; do not add HTTP-error-triggered restart loops.
- Phase 7: core structured logging remains to be completed; never log cookies, tokens, connection strings, raw exceptions, or customer request bodies.
- Phase 8: post-deploy and rollback gates must remain explicit for incident fixes.

## Read-only smoke

`npm run smoke:production -- https://furmosa-hq-production.up.railway.app`

The smoke contract always uses canonical `/api/health`. `/api/health/live` and `/api/health/ready` are not required production probes; their absence is not an incident. Do not restore a `--baseline` versus `ready` split.

Do not use coupon listing as a production smoke read: the current service may expire rows on read. Do not invoke cron, refill completion, login actions, webhook, payment, seed or repair operations for smoke testing.

## Deployment and rollback checklist

1. Verify current head CI, no schema/migration or start/predeploy data writes, and the incident-specific acceptance tests.
2. Record the current SUCCESS deployment ID, commit SHA, service healthcheck settings and timestamp immediately before deploying.
3. Confirm a prior known-good deployment is available for rollback when the incident has meaningful runtime risk. Railway rollback guidance: https://docs.railway.com/guides/roll-back-bad-deploy
4. Preserve `/api/health` as the deployment healthcheck. Do not introduce a public DB-readiness endpoint as part of reliability work.
5. Verify Railway reports SUCCESS for the intended commit, run canonical read-only smoke checks, and inspect sanitized runtime/proxy errors. Never accept a login redirect as a successful authenticated business read.
6. If post-deploy verification fails, perform at most one safe rollback to the recorded known-good deployment, verify it, and stop further automated repair attempts for that incident.

No production database mutation, secret change, migration, seed, reset or business-data write is permitted as part of this reliability contract.
