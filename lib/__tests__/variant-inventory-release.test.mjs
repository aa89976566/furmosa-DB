import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { verifyScope, verifyBalances, PLAN, MIGRATION, OPENING } from '../../scripts/ops/deploy-collab-wax-opening.mjs';
const env={RELEASE_MIGRATION_PLAN:PLAN,GITHUB_ACTIONS:'true',RELEASE_EXPECTED_HEAD_SHA:'a'.repeat(40),RELEASE_PR_NUMBER:'641',DIRECT_URL:'postgresql://postgres.ukjjopridghvwzobrsus:ci-only@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres'};
const sql=readFileSync(OPENING,'utf8');
test('controlled opening accepts only exact SQL, migration and production release context',()=>{
 assert.doesNotThrow(()=>verifyScope(JSON.stringify([MIGRATION]),sql,env));
 for (const paths of [[],[MIGRATION,'prisma/migrations/other/migration.sql'],['prisma/migrations/other/migration.sql']]) assert.throws(()=>verifyScope(JSON.stringify(paths),sql,env));
 assert.throws(()=>verifyScope(JSON.stringify([MIGRATION]),sql+'-- changed',env),/checksum/);
 for(const patch of [{GITHUB_ACTIONS:'false'},{RELEASE_EXPECTED_HEAD_SHA:'main'},{RELEASE_PR_NUMBER:'0'},{RELEASE_MIGRATION_PLAN:'standard'},{DIRECT_URL:'postgresql://ci:ci@localhost:5432/ci'}]) assert.throws(()=>verifyScope(JSON.stringify([MIGRATION]),sql,{...env,...patch}));
});
const variants=['65200876290425','65200876323193','65200876355961','65200876388729'];
const rows=variants.map(variantId=>({variantId,unit:'顆',policy:'variant',quantity:20,ledgerQuantity:20,openings:1,openingQuantity:20,snapshotCandleCost:190,snapshotBundleCost:230}));
test('opening verification checks four scents, units, costs and exact ledger reconciliation',()=>{
 assert.equal(verifyBalances(rows).length,4);
 assert.throws(()=>verifyBalances(rows.slice(1)));
 for(const patch of [{variantId:'unknown'},{unit:'組'},{policy:'shared'},{openings:2},{openingQuantity:40},{snapshotCandleCost:1},{snapshotBundleCost:1},{quantity:19}]) assert.throws(()=>verifyBalances([{...rows[0],...patch},...rows.slice(1)]));
});
test('replayed opening verifies consumed quantities without resetting stock to twenty',()=>{
 const sold=rows.map((r,i)=>({...r,quantity:20-i,ledgerQuantity:20-i}));
 assert.deepEqual(verifyBalances(sold).map(r=>r.quantity),[20,19,18,17]);
});
