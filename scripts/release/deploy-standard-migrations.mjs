// Applies only the exact non-destructive migration.sql files verified for this PR.
// It never runs unrelated pending migrations, seeds, repairs or backfills.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, basename } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const raw = process.env.RELEASE_MIGRATION_PATHS?.trim();
if (!raw) throw new Error('Missing RELEASE_MIGRATION_PATHS');
const paths = JSON.parse(raw);
if (!Array.isArray(paths) || paths.length === 0) {
  throw new Error('Standard migration plan requires at least one migration path');
}

const prisma = new PrismaClient();
try {
  for (const path of [...new Set(paths)].sort()) {
    if (!/^prisma\/migrations\/[A-Za-z0-9_-]+\/migration\.sql$/.test(path)) {
      throw new Error(`Invalid standard migration path: ${path}`);
    }
    await applyMigration(path);
  }
} finally {
  await prisma.$disconnect();
}

async function applyMigration(path) {
  const name = basename(dirname(path));
  const sql = readFileSync(path, 'utf8');
  const checksum = createHash('sha256').update(sql).digest('hex');
  const rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE migration_name = $1',
    name,
  );
  const finished = rows.filter((row) => row.finished_at !== null);
  const unfinished = rows.filter((row) => row.finished_at === null);
  if (finished.length > 1 || (finished.length === 1 && finished[0].checksum !== checksum)) {
    throw new Error(`Migration checksum/history differs; stop for review: ${name}`);
  }
  if (unfinished.length > 0) {
    throw new Error(`Migration has an unfinished production attempt; stop for review: ${name}`);
  }
  if (finished.length === 1) {
    console.log(`Migration already applied with approved checksum: ${name}`);
    return;
  }

  const applySql = `BEGIN;
SET LOCAL lock_timeout='15s';
SELECT pg_advisory_xact_lock(hashtextextended('furmosa:standard-migration:v1',0));
${sql}
INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
VALUES (gen_random_uuid()::text,'${checksum}',now(),'${name}',now(),1);
COMMIT;`;
  const directory = mkdtempSync(join(tmpdir(), 'furmosa-standard-migration-'));
  try {
    const file = join(directory, 'apply.sql');
    writeFileSync(file, applySql, { mode: 0o600 });
    const result = spawnSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'db', 'execute', '--file', file, '--schema', 'prisma/schema.prisma'],
      { stdio: 'pipe', env: process.env },
    );
    if (result.status !== 0) {
      throw new Error(`Migration failed and was rolled back: ${name}\n${sanitize(result.stderr)}`);
    }
    console.log(`Migration applied: ${name}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function sanitize(value) {
  return String(value ?? '')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .slice(-4000);
}
