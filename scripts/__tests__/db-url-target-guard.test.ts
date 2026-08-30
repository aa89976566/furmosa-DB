import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();
const guard = path.join(root, 'scripts/lib/db-url-target-guard.py');

function decide(target: string, databaseUrl: string, directUrl: string) {
  try {
    const out = execFileSync(
      'python3',
      [guard, '--target', target, '--database-url', databaseUrl, '--direct-url', directUrl],
      { encoding: 'utf8' },
    );
    return { code: 0, data: JSON.parse(out) as Record<string, unknown> };
  } catch (error) {
    const err = error as { status?: number; stdout?: string };
    return {
      code: err.status ?? 1,
      data: JSON.parse(String(err.stdout || '{}')) as Record<string, unknown>,
    };
  }
}

describe('db-url-target-guard', () => {
  it('lets production use only the official supabase project', () => {
    const official =
      'postgresql://postgres.ukjjopridghvwzobrsus:secret-must-not-leak@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';
    const result = decide('production', official, official.replace(':6543/', ':5432/'));
    assert.equal(result.code, 0);
    assert.equal(result.data.ok, true);
    assert.equal(result.data.project_ref, 'ukjjopridghvwzobrsus');
    assert.equal(JSON.stringify(result.data).includes('secret-must-not-leak'), false);
  });

  it('stops preview when the project ref matches production', () => {
    const official =
      'postgresql://postgres.ukjjopridghvwzobrsus:secret-must-not-leak@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';
    const result = decide('preview', official, official);
    assert.notEqual(result.code, 0);
    assert.equal(result.data.reason, 'preview_must_not_use_production_project');
    assert.equal(JSON.stringify(result.data).includes('secret-must-not-leak'), false);
  });

  it('lets preview use a different project ref', () => {
    const preview =
      'postgresql://postgres.previewonlyabc123:secret-must-not-leak@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres';
    const result = decide('preview', preview, preview.replace(':6543/', ':5432/'));
    assert.equal(result.code, 0);
    assert.equal(result.data.ok, true);
    assert.equal(result.data.project_ref, 'previewonlyabc123');
    assert.notEqual(result.data.project_ref, 'ukjjopridghvwzobrsus');
  });

  it('sync script no longer writes one URL to production and preview together', () => {
    const src = readFileSync(path.join(root, 'scripts/sync-vercel-db-env.sh'), 'utf8');
    assert.equal(src.includes('["production", "preview"]'), false);
    assert.equal(src.includes('production+preview'), false);
    assert.match(src, /TARGET/);
    assert.match(src, /preview_must_not_use_production_project|db-url-target-guard/);
    assert.equal(src.includes('Redeploy Production from main'), false);
    assert.match(src, /POSTGRES_PRISMA_URL/);
    assert.match(src, /POSTGRES_URL/);
  });

  it('old production-repair doc no longer tells operators to copy the official URL into Preview', () => {
    const src = readFileSync(path.join(root, 'docs/FIX-VERCEL-DB-AUTH.md'), 'utf8');
    assert.equal(src.includes('建議 Preview 一併更新'), false);
    assert.match(src, /不得把正式庫連線寫進 Preview/);
    assert.match(src, /TARGET=production/);
  });
});
