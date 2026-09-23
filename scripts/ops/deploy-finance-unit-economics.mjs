// Explicit, bounded deployment step: applies only the approved finance
// unit-economics migration. Never runs unrelated migrations or rewrites sales.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const name = '20260923180000_finance_unit_economics';
const migrationSql = readFileSync(`prisma/migrations/${name}/migration.sql`, 'utf8');
const checksum = createHash('sha256').update(migrationSql).digest('hex');
const prisma = new PrismaClient();
let rows;

try {
  rows = await prisma.$queryRawUnsafe(
    'SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE migration_name = $1',
    name,
  );
} catch (error) {
  console.error('Unable to inspect the approved finance migration state.');
  console.error(sanitize(error));
  process.exit(1);
} finally {
  await prisma.$disconnect();
}

const finished = rows.filter((row) => row.finished_at !== null);
const unfinished = rows.filter((row) => row.finished_at === null);
if (finished.length > 1 || (finished.length === 1 && finished[0].checksum !== checksum)) {
  console.error(`Finance migration checksum/history differs; stop for review: ${name}`);
  process.exit(1);
}
if (finished.length === 0 && unfinished.length > 0) {
  console.error(`Finance migration has an unfinished production attempt; stop for review: ${name}`);
  process.exit(1);
}

const applySql = finished.length === 1
  ? `DO $guard$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name='${name}' AND finished_at IS NOT NULL AND checksum='${checksum}') THEN
  RAISE EXCEPTION 'Finance migration state changed; rerun release: ${name}';
 END IF;
END $guard$;`
  : `DO $guard$
BEGIN
 IF EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name='${name}') THEN
  RAISE EXCEPTION 'Finance migration state changed; rerun release: ${name}';
 END IF;
END $guard$;
${migrationSql}
INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
VALUES (gen_random_uuid()::text,'${checksum}',now(),'${name}',now(),1);`;

const sql = `BEGIN;
SET LOCAL lock_timeout='15s';
SELECT pg_advisory_xact_lock(hashtextextended('hq:finance-unit-economics:v1',0));
${applySql}
COMMIT;`;
const dir = mkdtempSync(join(tmpdir(), 'hq-finance-'));

try {
  const file = join(dir, 'apply.sql');
  writeFileSync(file, sql, { mode: 0o600 });
  const result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'db', 'execute', '--file', file, '--schema', 'prisma/schema.prisma'],
    { stdio: 'pipe', env: process.env },
  );
  if (result.status !== 0) {
    console.error('Finance unit-economics migration failed; database transaction rolled back.');
    console.error(sanitize(result.stderr));
    process.exitCode = 1;
  } else {
    console.log('Approved finance unit-economics migration applied or already present.');
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

function sanitize(value) {
  return String(value ?? '')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[REDACTED_DATABASE_URL]')
    .slice(-4000);
}
