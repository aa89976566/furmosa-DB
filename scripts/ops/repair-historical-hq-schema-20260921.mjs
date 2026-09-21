// One-time recovery for migrations merged before the controlled release runner
// existed. It applies only additive HQ schema migrations and never runs a
// baseline stocktake, seed, backfill, or unrelated pending migration.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const names = [
  '20260915130000_hq_bulk_inventory',
  '20260916140000_add_order_archive',
  '20260917103000_hq_inventory_advisory',
];

const migrations = names.map((name) => {
  const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
  return { name, sql, checksum: createHash('sha256').update(sql).digest('hex') };
});

const prisma = new PrismaClient();
let rows;
try {
  rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE migration_name = ANY($1::text[])',
    names,
  );
} catch (error) {
  console.error('Unable to inspect the historical HQ migration state.');
  console.error(sanitize(error));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

const state = migrations.map((migration) => {
  const matching = rows.filter((row) => row.migration_name === migration.name);
  const finished = matching.filter((row) => row.finished_at !== null);
  const unfinished = matching.filter((row) => row.finished_at === null);
  if (finished.length > 1 || (finished.length === 1 && finished[0].checksum !== migration.checksum)) {
    throw new Error(`Migration checksum/history differs; stop for review: ${migration.name}`);
  }
  if (finished.length === 0 && unfinished.length > 0) {
    throw new Error(`Migration has an unfinished production attempt; stop for review: ${migration.name}`);
  }
  return { migration, finished: finished.length === 1 };
});

// Original migrations are ordered. A completed later migration with a missing
// earlier migration indicates a partial/manual deployment and must be reviewed.
const firstPending = state.findIndex((item) => !item.finished);
if (firstPending !== -1 && state.slice(firstPending).some((item) => item.finished)) {
  throw new Error('Historical migration records are out of order; stop for review.');
}

const applySql = state.map(({ migration, finished }, index) => {
  if (finished) {
    return `DO $guard_${index}$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name='${migration.name}' AND finished_at IS NOT NULL AND checksum='${migration.checksum}') THEN
  RAISE EXCEPTION 'Migration state changed; rerun release: ${migration.name}';
 END IF;
END $guard_${index}$;`;
  }
  return `DO $guard_${index}$
BEGIN
 IF EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name='${migration.name}') THEN
  RAISE EXCEPTION 'Migration state changed; rerun release: ${migration.name}';
 END IF;
END $guard_${index}$;
${migration.sql}
INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
VALUES (gen_random_uuid()::text,'${migration.checksum}',now(),'${migration.name}',now(),1);`;
}).join('\n');

const sql = `BEGIN;
SET LOCAL lock_timeout='15s';
SELECT pg_advisory_xact_lock(hashtextextended('hq:historical-schema-repair:20260921',0));
${applySql}
COMMIT;`;

const dir = mkdtempSync(join(tmpdir(), 'hq-schema-repair-'));
try {
  const file = join(dir, 'apply.sql');
  writeFileSync(file, sql, { mode: 0o600 });
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'db', 'execute', '--file', file, '--schema', 'prisma/schema.prisma'],
    { stdio: 'pipe', env: process.env },
  );
  if (result.status !== 0) {
    console.error('Historical HQ schema repair failed; database transaction rolled back.');
    console.error(sanitize(result.stderr));
    process.exitCode = 1;
  } else {
    console.log('Historical HQ schema migrations applied or already present; no stocktake or business data was changed.');
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

function sanitize(value) {
  return String(value ?? '')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .slice(-4000);
}
