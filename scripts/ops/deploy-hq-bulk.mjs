// Explicit, bounded deployment step: applies only the approved HQ bulk
// migrations + six authorized baseline counts. Never runs unrelated migrations.
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';

const names=['20260915130000_hq_bulk_inventory','20260917103000_hq_inventory_advisory'];
const migrations=names.map(name=>{
 const sql=readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8');
 return {name,sql,checksum:createHash('sha256').update(sql).digest('hex')};
});
const baseline=readFileSync('scripts/ops/hq-stocktake-20260915.sql','utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const prisma=new PrismaClient();
let rows;
try {
 rows=await prisma.$queryRawUnsafe(
  'SELECT migration_name, checksum, finished_at FROM _prisma_migrations WHERE migration_name = ANY($1::text[])',
  names,
 );
} catch (error) {
 console.error('Unable to inspect the approved production migration state.');
 console.error(sanitize(error));
 process.exit(1);
} finally {
 await prisma.$disconnect();
}

const pending=[];
for (const migration of migrations) {
 const matching=rows.filter(row=>row.migration_name===migration.name);
 const finished=matching.filter(row=>row.finished_at!==null);
 const unfinished=matching.filter(row=>row.finished_at===null);
 if (finished.length>1 || (finished.length===1 && finished[0].checksum!==migration.checksum)) {
  console.error(`HQ migration checksum/history differs; stop for review: ${migration.name}`);
  process.exit(1);
 }
 if (finished.length===0 && unfinished.length>0) {
  console.error(`HQ migration has an unfinished production attempt; stop for review: ${migration.name}`);
  process.exit(1);
 }
 if (finished.length===0) pending.push(migration);
}

const migrationSql=migrations.map((migration,index)=>{
 const isPending=pending.some(item=>item.name===migration.name);
 if (!isPending) return `DO $guard_${index}$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name='${migration.name}' AND finished_at IS NOT NULL AND checksum='${migration.checksum}') THEN
  RAISE EXCEPTION 'HQ migration state changed; rerun release: ${migration.name}';
 END IF;
END $guard_${index}$;`;
 return `DO $guard_${index}$
BEGIN
 IF EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name='${migration.name}') THEN
  RAISE EXCEPTION 'HQ migration state changed; rerun release: ${migration.name}';
 END IF;
END $guard_${index}$;
${migration.sql}
INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
VALUES (gen_random_uuid()::text,'${migration.checksum}',now(),'${migration.name}',now(),1);`;
}).join('\n');

const sql=`BEGIN;
SET LOCAL lock_timeout='15s';
SELECT pg_advisory_xact_lock(hashtextextended('hq:bulk-deployment:v1',0));
${migrationSql}
${baseline}
COMMIT;`;
const dir=mkdtempSync(join(tmpdir(),'hq-bulk-'));
try {
 writeFileSync(join(dir,'apply.sql'),sql,{mode:0o600});
 const result=spawnSync(process.execPath,['node_modules/prisma/build/index.js','db','execute','--file',join(dir,'apply.sql'),'--schema','prisma/schema.prisma'],{stdio:'pipe',env:process.env});
 if(result.status!==0) {
  console.error('HQ bulk migration/baseline failed; database transaction rolled back.');
  console.error(sanitize(result.stderr));
  process.exitCode=1;
 } else {
  console.log('Approved HQ bulk migrations and six identity-checked baseline counts applied or already present.');
 }
} finally {
 rmSync(dir,{recursive:true,force:true});
}

function sanitize(value) {
 return String(value ?? '')
  .replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[REDACTED_DATABASE_URL]')
  .slice(-4000);
}
