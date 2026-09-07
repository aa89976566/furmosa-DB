# Production Reliability — 2026-09-07

Status: **NOT READY TO DEPLOY**. PR #188 remains a draft.

## Verified work

- Health readiness accepts the same three DB URL names as Prisma and rejects blank settings.
- Readiness uses a 2-second HTTP timeout with one shared outstanding SELECT 1 per process. Timeout does not cancel SQL; unresolved work remains shared until settlement. No restart is triggered.
- Claude reviewed the two health files at `1981e046` and returned NO BLOCKER: https://github.com/aa89976566/furmosa-DB/pull/188#issuecomment-5571243477
- CI run 34124762778 at `1981e046`: 818/818 tests, Prisma validation, isolated PostgreSQL migrations, typecheck and build passed. Subsequent commits require fresh CI.
- CI build uses production NODE_ENV; test NODE_ENV is scoped to the test step.
- Removed default refill image paths are mapped during reads. Custom URLs and stored data are untouched.
- Fifteen previously omitted route/middleware tests passed with Node's type-stripping runner and are now included in npm test. They cannot use the existing tsx CommonJS runner because their harness uses top-level await.
- Railway restart policy was set to ON_FAILURE, max 3, for the next deployment. No deployment or restart was triggered.
- Production baseline: `/api/health`, `/login`, `/pos/login` returned 200; `/orders`, `/pos` returned the expected login redirects; `/api/merchant/refill-orders` returned 401. This does not verify authenticated business reads.

## Platform blockers

1. Main branch protection form is prepared: require PR, require GitHub Actions `verify`, require up-to-date branch, disallow admin bypass. Saving stopped at GitHub Confirm access. The rule is **not confirmed saved**.
2. Railway `source.checkSuites` remains false. The browser's Wait for CI control is disabled; the connected service update tool cannot change source settings. Enable and verify it using an account with edit access before deployment.
3. Railway dashboard shows pre-existing staged changes. Inspect their exact scope before accepting an environment deployment. Do not commit unknown staged changes.
4. Keep the platform probe at `/api/health` until the new health endpoints are in the verified deployment candidate and deployment gating is effective; switching early could reject unrelated deployments of current main.
5. Main is changing concurrently. Fetch again, merge main into the candidate, rerun CI, and record the exact head and main SHAs immediately before any merge.

## Remaining phases

- Phase 2: complete platform gate and readiness attachment, verify rollback availability.
- Phase 4: read-only smoke script prepared; authenticated POS and order read verification remains required using existing authorized sessions, without creating accounts or records.
- Phase 5: idempotency audit is incomplete and no new business-write guard has been applied. Confirmed gaps include coupon verify-then-update without an atomic available-state predicate; point ledger append reads the previous balance without a common lock across all callers; POS quantity correction writes stock rows and its audit record outside one transaction. Manual point adjustments already use a customer row lock and requestId replay lookup. Refill order idempotency and Shopify event deduplication already exist and must be preserved. Audit actual callers and concurrency tests before changing each flow.
- Phase 6: process crash retry limit prepared; no HTTP-error-triggered restart or autonomous recovery loop exists in this change.
- Phase 7: core structured logging remains to be implemented; never log cookies, tokens, connection strings, raw exceptions, or customer request bodies.
- Phase 8: post-deploy and rollback gates remain incomplete. Do not label the whole 0→8 task complete based on health/CI alone.

## Read-only smoke

`npm run smoke:production -- https://furmosa-hq-production.up.railway.app`

Use `--baseline` only before the new endpoints are deployed. Baseline success is not post-deploy success. The script uses only a fixed list of GET routes, rejects credentials in the origin, never follows redirects, never sends sessions and reports no response bodies. A redirect where health/login content is expected is a failure.

Do not use coupon listing as a production smoke read: the current service expires rows on read. Do not invoke cron, refill completion, login actions, webhook, payment, seed or repair operations for smoke testing.

## Deployment and rollback checklist (not yet executed)

1. Verify current head CI and review, required branch protection, Railway Wait for CI, no schema/migration or start/predeploy data writes, and all remaining phase acceptance tests.
2. Record the current SUCCESS deployment ID, commit SHA, settings and timestamp immediately before deploying. As of the earlier inspection, deployment `ff25a4ec-0007-4f45-82b2-81026e77af7c` ran `3dcd25f`; this is a historical observation, **not a fixed rollback target**.
3. Confirm the prior deployment exposes Rollback in the dashboard and is within retention. Railway rollback restores an image and its custom variables; a generic redeploy is not proof of rollback capability. Reference: https://docs.railway.com/guides/roll-back-bad-deploy
4. Attach `/api/health/ready` with a bounded startup window only when the verified candidate is ready. Apply only reviewed staged changes. Preserve one replica and avoid migrations.
5. Verify Railway reports SUCCESS for the intended commit, run the new-endpoint smoke checks and existing-session read verification, and inspect sanitized runtime failures. Never accept a login redirect as a successful authenticated order read.
6. If the candidate fails deployment readiness, leave the prior deployment serving. If post-deploy verification fails, use the recorded prior deployment's Rollback action, then verify its commit/status and baseline. If rollback is unavailable, stop before deployment; do not substitute unverified source rebuilds.

No production database mutation, secret change, migration, restart, merge to main or reliability deployment has been performed by this task.
