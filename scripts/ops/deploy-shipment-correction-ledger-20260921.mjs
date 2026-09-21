// Explicit, bounded production step for the shipment-correction ledger only.
// It records the Prisma checksum and never runs unrelated migrations or seeds.
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const name = '20260921153000_shipment_status_correction_ledger';
const sql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
const checksum = createHash('sha256').update(sql).digest('hex');
const prisma = new PrismaClient();
let rows;
try {
  rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE migration_name = $1',
    name,
  );
} catch (error) {
  console.error('Unable to inspect the shipment-correction migration state.');
  console.error(sanitize(error));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

const finished = rows.filter((row) => row.finished_at !== null);
const unfinished = rows.filter((row) => row.finished_at === null);
if (finished.length > 1 || (finished.length === 1 && finished[0].checksum !== checksum)) {
  console.error(`Migration checksum/history differs; stop for review: ${name}`);
  process.exit(1);
}
if (unfinished.length > 0) {
  console.error(`Migration has an unfinished production attempt; stop for review: ${name}`);
  process.exit(1);
}
if (finished.length === 1) {
  console.log('Shipment-correction ledger migration is already applied with the approved checksum.');
  process.exit(0);
}

const applySql = `BEGIN;
SET LOCAL lock_timeout='15s';
SELECT pg_advisory_xact_lock(hashtextextended('hq:shipment-correction-ledger:20260921',0));
${sql}
INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
VALUES (gen_random_uuid()::text,'${checksum}',now(),'${name}',now(),1);
COMMIT;`;
const directory = mkdtempSync(join(tmpdir(), 'shipment-correction-ledger-'));
try {
  const file = join(directory, 'apply.sql');
  writeFileSync(file, applySql, { mode: 0o600 });
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'db', 'execute', '--file', file, '--schema', 'prisma/schema.prisma'],
    { stdio: 'pipe', env: process.env },
  );
  if (result.status !== 0) {
    console.error('Shipment-correction ledger migration failed; database transaction rolled back.');
    console.error(sanitize(result.stderr));
    process.exitCode = 1;
  } else {
    console.log('Shipment-correction ledger migration applied.');
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}

function sanitize(value) {
  return String(value ?? '')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .slice(-4000);
}
