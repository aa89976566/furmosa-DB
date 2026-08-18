import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

export const PREVIEW_WHITELIST_DIRS = [
  'app/preview/merchant-pos',
  'components/merchant-pos-preview',
  'lib/merchant-pos-preview',
];

const FORBIDDEN = [
  /prisma/i,
  /DATABASE_URL/,
  /fetch\s*\(/,
  /['"]use server['"]/,
  /['"`]\/api\//,
  /localStorage/,
  /sessionStorage/,
  /indexedDB/,
  /document\.cookie/,
  /lib\/pos\/domain-contract/,
];

function walk(dir: string): string[] {
  const abs = path.join(root, dir);
  return readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    if (/\.(ts|tsx|css)$/.test(entry.name)) return [rel];
    return [];
  });
}

describe('merchant POS preview static guard', () => {
  it('new files stay inside the preview whitelist and avoid runtime I/O', () => {
    const files = PREVIEW_WHITELIST_DIRS.flatMap(walk);
    assert.ok(files.length >= 16, `expected preview files, got ${files.length}`);

    for (const file of files) {
      if (file.includes('/__tests__/')) continue;
      const src = readFileSync(path.join(root, file), 'utf8');
      for (const pattern of FORBIDDEN) {
        assert.equal(pattern.test(src), false, `${file} matched ${pattern}`);
      }
    }
  });
});
