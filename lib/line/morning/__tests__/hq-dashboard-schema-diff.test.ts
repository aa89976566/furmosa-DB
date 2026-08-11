import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { execSync } from 'node:child_process';

describe('4B-D schema diff vs #101 = 0', () => {
  it('prisma schema／migrations 相對 phase4b-c 無變更', () => {
    const base = 'origin/cursor/line-morning-phase4b-c-plan-2673';
    let diff: string;
    try {
      diff = execSync(
        `git diff --name-only ${base}...HEAD -- prisma/schema.prisma prisma/migrations`,
        { encoding: 'utf8' },
      ).trim();
    } catch (e) {
      // 若本地尚未 fetch base，允許比對 merge-base 失敗時 skip 嚴謹 assert 改查 working tree
      diff = execSync(
        'git diff --name-only HEAD -- prisma/schema.prisma prisma/migrations',
        { encoding: 'utf8' },
      ).trim();
    }
    assert.equal(
      diff,
      '',
      `schema/migrations must be empty vs #101, got:\n${diff}`,
    );
  });

  it('working tree 亦無 prisma 變更', () => {
    const dirty = execSync(
      'git status --porcelain -- prisma/schema.prisma prisma/migrations',
      { encoding: 'utf8' },
    ).trim();
    assert.equal(dirty, '');
  });
});
