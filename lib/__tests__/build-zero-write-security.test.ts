/**
 * PR-A Build 零寫入 — 不連 DB 的安全 contract 測試。
 *
 * 只讀取原始碼／package.json 字串，不 import 業務模組、不執行腳本、不連資料庫。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

describe('PR-A build zero-write security contracts (no DB)', () => {
  it('package.json scripts.build equals prisma generate && next build', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as {
      scripts: { build: string };
    };
    assert.equal(pkg.scripts.build, 'prisma generate && next build');
  });

  it('build script string has no migrate / seed / db push / ensure-demo-admin', () => {
    const pkg = JSON.parse(readRepoFile('package.json')) as {
      scripts: { build: string };
    };
    const build = pkg.scripts.build;
    for (const forbidden of [
      'migrate',
      'resolve',
      'deploy',
      'seed',
      'db push',
      'ensure-demo-admin',
    ]) {
      assert.equal(
        build.includes(forbidden),
        false,
        `build must not contain ${forbidden}`,
      );
    }
  });

  it('login page does not expose test accounts or fixed password', () => {
    const login = readRepoFile('app/login/page.tsx');
    for (const forbidden of [
      'furmosa2026',
      'admin@furmosa.com',
      'finance@furmosa.com',
      'ops@furmosa.com',
      'wh@furmosa.com',
      '測試帳號',
      '密碼皆為',
    ]) {
      assert.equal(
        login.includes(forbidden),
        false,
        `login page must not contain ${forbidden}`,
      );
    }
  });

  it('ensure-demo-admin source has no fixed password or mutating paths', () => {
    const src = readRepoFile('scripts/ensure-demo-admin.ts');

    // 固定密碼：全字串禁止
    assert.equal(
      src.includes('furmosa2026'),
      false,
      'ensure-demo-admin.ts must not contain furmosa2026',
    );

    // 實際危險程式模式（精準；不把安全註解「不 rebind」當失敗）
    const dangerousPatterns: Array<{ name: string; re: RegExp }> = [
      { name: 'merchantUser.update(', re: /merchantUser\.update\s*\(/ },
      { name: 'user.update(', re: /\buser\.update\s*\(/ },
      { name: '.upsert(', re: /\.upsert\s*\(/ },
      {
        name: 'existing-account passwordHash update data',
        re: /\.update\s*\(\s*\{[\s\S]*?passwordHash\s*:/,
      },
      // 舊妞妞自動路徑符號／可執行呼叫（不用裸字 rebind，避免誤傷「不 rebind」註解）
      { name: 'POS_NIUNIU_USERNAME', re: /\bPOS_NIUNIU_USERNAME\b/ },
      { name: 'findNiuniuMerchant', re: /\bfindNiuniuMerchant\b/ },
      { name: 'pickNiuniuMerchant', re: /\bpickNiuniuMerchant\b/ },
      { name: 'shouldEnsureNiuniu', re: /\bshouldEnsureNiuniu\b/ },
      { name: 'ENSURE_NIUNIU_POS', re: /\bENSURE_NIUNIU_POS\b/ },
      { name: 'rebindIfWrongMerchant', re: /\brebindIfWrongMerchant\b/ },
      { name: "literal username 'niuniu'", re: /['"]niuniu['"]/ },
    ];

    for (const { name, re } of dangerousPatterns) {
      assert.equal(
        re.test(src),
        false,
        `ensure-demo-admin.ts must not contain dangerous pattern: ${name}`,
      );
    }
  });

  it('ensure-demo-admin source includes fail-closed guards', () => {
    const src = readRepoFile('scripts/ensure-demo-admin.ts');
    assert.match(src, /VERCEL_ENV\s*===\s*['"]production['"]/);
    assert.match(src, /ENABLE_DEMO_ADMIN\s*!==\s*['"]1['"]/);
    assert.match(src, /DEMO_ADMIN_PASSWORD/);
    assert.match(
      src,
      /MIN_PASSWORD_LENGTH\s*=\s*16|password\.length\s*<\s*16/,
    );
  });

  it('assertSafeToRun() is called before createPrisma() in main', () => {
    const src = readRepoFile('scripts/ensure-demo-admin.ts');
    const assertCall = src.indexOf('const password = assertSafeToRun()');
    const createCall = src.indexOf('const prisma = createPrisma()');
    assert.notEqual(assertCall, -1, 'missing assertSafeToRun() call');
    assert.notEqual(createCall, -1, 'missing createPrisma() call');
    assert.ok(
      assertCall < createCall,
      'assertSafeToRun() must appear before createPrisma() call',
    );
  });
});
