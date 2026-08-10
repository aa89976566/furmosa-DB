import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PLAN_DIR = resolve(process.cwd(), 'lib/line/morning/plan');

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name.endsWith('.ts')) out.push(p);
  }
  return out;
}

describe('Phase 4B-C structural zero-send', () => {
  it('plan runner 模組禁止 import sender／push／broadcast／reply', () => {
    const files = listTsFiles(PLAN_DIR);
    assert.ok(files.length >= 4);
    const forbidden = [
      /from ['"]@\/lib\/line\/push['"]/,
      /from ['"]@\/lib\/line\/reply['"]/,
      /pushLineMessages/,
      /broadcast/,
      /getMorningOutboundSender/,
      /isDryRun\s*=\s*false/,
    ];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      for (const re of forbidden) {
        assert.equal(
          re.test(src),
          false,
          `${file} matches forbidden ${re}`,
        );
      }
    }
  });

  it('vercel.json 無 morning cron；無公開 send endpoint', () => {
    const vercel = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');
    assert.ok(!/line-morning/.test(vercel));
    const sendRoutes = [
      'app/api/line/morning/send',
      'app/api/cron/line-morning-send',
    ];
    for (const p of sendRoutes) {
      try {
        readFileSync(resolve(process.cwd(), p, 'route.ts'));
        assert.fail(`should not exist: ${p}`);
      } catch (e) {
        assert.ok(e instanceof Error);
      }
    }
  });

  it('plan-preview／hq-actions 同邊界', () => {
    for (const rel of [
      'lib/line/morning/plan-preview.ts',
      'lib/line/morning/plan/hq-actions.ts',
    ]) {
      const src = readFileSync(resolve(process.cwd(), rel), 'utf8');
      assert.ok(!src.includes("from '@/lib/line/push'"));
      assert.ok(!src.includes('pushLineMessages'));
    }
  });
});
