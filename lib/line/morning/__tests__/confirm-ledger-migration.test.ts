import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Migration-level dry-run 契約：
 * - 只 CREATE confirm ledger 表
 * - 不 ALTER／UPDATE／DELETE line_morning_preferences
 * - 因此 alternate／off／unset 既有列不受影響
 */
describe('Phase 4B-B confirm ledger migration dry-run', () => {
  const sqlPath = resolve(
    process.cwd(),
    'prisma/migrations/20260808220000_line_morning_preference_confirm_ledger/migration.sql',
  );
  const sql = readFileSync(sqlPath, 'utf8');

  it('additive CREATE TABLE only；不碰 preferences 既有資料', () => {
    assert.ok(sql.includes('CREATE TABLE "line_morning_preference_confirm_ledgers"'));
    assert.ok(
      sql.includes('event_dedup_key'),
      'unique eventDedupKey column',
    );
    assert.ok(
      sql.includes('session_nonce_hash'),
      'nonce hash only（不存 raw nonce）',
    );
    assert.ok(
      sql.includes(
        'line_morning_preference_confirm_ledgers_session_nonce_hash_payload_digest_key',
      ),
    );
    assert.ok(sql.includes('expires_at'));

    const forbidden = [
      /ALTER\s+TABLE\s+"line_morning_preferences"/i,
      /UPDATE\s+"line_morning_preferences"/i,
      /DELETE\s+FROM\s+"line_morning_preferences"/i,
      /DROP\s+TABLE\s+"line_morning_preferences"/i,
      /ALTER\s+COLUMN\s+"content_mode"/i,
      /ALTER\s+COLUMN\s+"frequency"/i,
    ];
    for (const re of forbidden) {
      assert.equal(re.test(sql), false, `forbidden pattern ${re}`);
    }
  });

  it('schema.prisma 含雙 unique；舊 migration 檔未改寫', () => {
    const schema = readFileSync(
      resolve(process.cwd(), 'prisma/schema.prisma'),
      'utf8',
    );
    assert.ok(schema.includes('model LineMorningPreferenceConfirmLedger'));
    assert.ok(schema.includes('@@unique([sessionNonceHash, payloadDigest])'));
    assert.ok(schema.includes('@unique @map("event_dedup_key")'));

    const oldMig = readFileSync(
      resolve(
        process.cwd(),
        'prisma/migrations/20260808120000_line_morning_phase4b_a_domain/migration.sql',
      ),
      'utf8',
    );
    assert.ok(oldMig.includes('line_morning_animal_facts'));
    assert.ok(!oldMig.includes('confirm_ledger'));
  });
});
