import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';

const root = process.cwd();

const PREVIEW_DIRS = [
  'lib/grooming-voucher-preview',
  'components/grooming-voucher-preview',
  'app/pos/grooming-voucher-preview',
  'app/(main)/admin/grooming-voucher-preview',
];

const FORBIDDEN_IMPORT = /from\s+['"][^'"]*(?:prisma|@prisma\/client|ecpay|merchant-auth|auth-edge|auth-secret)['"]/i;
const FORBIDDEN_FETCH = /\bfetch\s*\(/;
const FORBIDDEN_API_PATH = /['"`]\/api\//;
const FORBIDDEN_SERVER_ACTION = /['"]use server['"]/;
const FORBIDDEN_MUTATION_IMPORT =
  /from\s+['"]@\/lib\/(?:orders|settlements|payments|stock|coupons\/service)['"]/;
const FORBIDDEN_WORDS = [
  /\bPrismaClient\b/,
  /\bprisma\./,
  /schema\.prisma/,
  /migrate/,
  /db push/,
  /ECPay/,
  /ecpay/,
];

const REAL_DATA_MARKERS = [
  '0912',
  'zhuwo_',
  'mer_0016',
  'FURMOSA-',
  '王小明',
  'admin@furmosa.com',
];

function walkFiles(dir: string): string[] {
  const abs = path.join(root, dir);
  let entries: string[] = [];
  try {
    entries = readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) return walkFiles(rel);
      if (/\.(ts|tsx)$/.test(entry.name)) return [rel];
      return [];
    });
  } catch {
    return [];
  }
  return entries;
}

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8');
}

describe('grooming voucher preview static contract', () => {
  it('preview files exist and stay fixture-only', () => {
    const files = PREVIEW_DIRS.flatMap(walkFiles);
    assert.ok(files.length >= 8, `expected preview files, got ${files.length}`);

    for (const file of files) {
      const src = read(file);
      assert.equal(FORBIDDEN_IMPORT.test(src), false, `${file} has forbidden import`);
      assert.equal(FORBIDDEN_FETCH.test(src), false, `${file} calls fetch`);
      assert.equal(FORBIDDEN_API_PATH.test(src), false, `${file} mentions /api/`);
      assert.equal(FORBIDDEN_SERVER_ACTION.test(src), false, `${file} has use server`);
      assert.equal(
        FORBIDDEN_MUTATION_IMPORT.test(src),
        false,
        `${file} imports a mutation module`,
      );
      if (!file.includes('/__tests__/')) {
        for (const re of FORBIDDEN_WORDS) {
          assert.equal(re.test(src), false, `${file} matches ${re}`);
        }
        for (const marker of REAL_DATA_MARKERS) {
          assert.equal(src.includes(marker), false, `${file} leaked real-data marker ${marker}`);
        }
      }
    }
  });

  it('legacy POST /api/coupons route file is unchanged 410 stub', () => {
    const src = read('app/api/coupons/route.ts');
    assert.equal(
      src,
      `const GONE_JSON = '{"error":"此兌換入口已停用"}';

export async function POST() {
  return new Response(GONE_JSON, {
    status: 410,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
`,
    );
    assert.equal(src.includes('prisma'), false);
    assert.equal(src.includes('redeem'), false);
  });

  it('does not mention phone or email fields in preview fixtures', () => {
    const fixtures = read('lib/grooming-voucher-preview/fixtures.ts');
    assert.equal(/\bphone\b/i.test(fixtures), false);
    assert.equal(/\bemail\b/i.test(fixtures), false);
    assert.equal(fixtures.includes('@'), false);
  });
});
