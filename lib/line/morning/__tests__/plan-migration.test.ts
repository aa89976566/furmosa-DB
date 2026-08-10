import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Phase 4B-C plan ledger migration dry-run', () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      'prisma/migrations/20260810120000_line_morning_plan_ledger/migration.sql',
    ),
    'utf8',
  );

  it('additive CREATE only；不碰 preferences／confirm ledger', () => {
    assert.ok(sql.includes('CREATE TABLE "line_morning_plan_ledgers"'));
    assert.ok(sql.includes('run_date_line_user_id_key'));
    const forbidden = [
      /ALTER\s+TABLE\s+"line_morning_preferences"/i,
      /UPDATE\s+"line_morning_preferences"/i,
      /line_morning_preference_confirm_ledgers"/i,
      /DROP\s+TABLE\s+"line_morning_preferences"/i,
    ];
    for (const re of forbidden) {
      assert.equal(re.test(sql), false, String(re));
    }
  });

  it('schema 含 @@unique([runDate, lineUserId])', () => {
    const schema = readFileSync(
      resolve(process.cwd(), 'prisma/schema.prisma'),
      'utf8',
    );
    assert.ok(schema.includes('model LineMorningPlanLedger'));
    assert.ok(schema.includes('@@unique([runDate, lineUserId])'));
  });
});
