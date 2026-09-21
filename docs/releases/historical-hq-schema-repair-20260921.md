# Historical HQ schema repair — 2026-09-21

## Purpose

Repair additive HQ schema migrations that were merged before the controlled
production-release runner existed.

## Scope

Only these existing migrations are eligible:

- `20260915130000_hq_bulk_inventory`
- `20260916140000_add_order_archive`
- `20260917103000_hq_inventory_advisory`

The runner validates recorded checksums and migration order, uses one
transaction plus an advisory lock, and rolls back on any failure.

## Explicit exclusions

This release does not run stocktake, seed, backfill, unrelated migrations, or
business-data writes.

## Validation

The release workflow must pass exact-PR, CI, checksum, readiness, Railway, and smoke checks before completion.
