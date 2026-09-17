// Explicit, bounded deployment step: applies only the approved HQ bulk
// migrations + six authorized baseline counts. Never runs unrelated migrations.
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const names=['20260915130000_hq_bulk_inventory','20260917103000_hq_inventory_advisory'];
const migrations=names.map(name=>{
 const sql=readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8');
 return {name,sql,checksum:createHash('sha256').update(sql).digest('hex')};
});
const baseline=readFileSync('scripts/ops/hq-stocktake-20260915.sql','utf8').replace(/^BEGIN;$/m,'').replace(/^COMMIT;$/m,'');
const migrationSql=migrations.map(({name,sql:body,checksum},index)=>`DO $deploy_${index}$
BEGIN
 IF EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name='${name}' AND finished_at IS NOT NULL AND checksum <> '${checksum}') THEN
  RAISE EXCEPTION 'HQ migration checksum differs; stop for review: ${name}';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM _prisma_migrations WHERE migration_name='${name}' AND finished_at IS NOT NULL) THEN
  EXECUTE $migration_${index}$${body}$migration_${index}$;
  INSERT INTO _prisma_migrations (id,checksum,finished_at,migration_name,started_at,applied_steps_count)
  VALUES (gen_random_uuid()::text,'${checksum}',now(),'${name}',now(),1);
 END IF;
END $deploy_${index}$;`).join('\n');
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
 if(result.status!==0) { console.error('HQ bulk migration/baseline failed; database transaction rolled back.'); process.exitCode=1; }
 else console.log('Approved HQ bulk migrations and six identity-checked baseline counts applied or already present.');
} finally {rmSync(dir,{recursive:true,force:true});}
