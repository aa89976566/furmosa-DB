/**
 * 真實 PostgreSQL 結算測試。
 *
 * 凍結規格見 docs/reviews/pos-settlement-v1.md §1.11。純邏輯測試用假 client 驗行為，
 * 但唯一約束、partial unique index、CHECK 與 ON DELETE RESTRICT 只有真資料庫能驗；
 * 交易回滾也只有真資料庫能證明「整批拒絕」沒有殘留。
 *
 * 安全邊界（不可放寬）：
 * - 只接受專用的 `SETTLEMENT_TEST_DATABASE_URL`，**不得** fallback 到
 *   `DATABASE_URL` 或 `DIRECT_URL`。
 * - 以**正向白名單**放行：loopback 主機 ＋ 專用測試資料庫名 ＋ 明確隔離確認旗標。
 *   三者缺一就跳過，不是「看起來不像正式庫就跑」。
 * - 連線字串在任何情況下都不印出，跳過理由也不含連線字串。
 * - 本檔不執行 migration。資料庫結構必須已由執行者自行套用；缺結構時直接失敗，
 *   不自動建表，也不降級成「假裝通過」。
 * - 只操作本檔自己建立、帶專用前綴的資料列，結束時清乾淨。
 * - 曝險防護測試會在這個隔離庫建立 anon／authenticated 角色並改動
 *   `SettlementSourceItem` 一張表的權限，用來重現 Supabase 的預設授權。
 *   不改全域 default privileges，不動其他表，結束時該表停在「已防護」狀態。
 *   因為要 CREATE ROLE，這個隔離庫的連線角色需要 superuser 或 CREATEROLE。
 *
 * 執行方式（由獨立驗收者在自己的專用本機庫執行）：
 *   SETTLEMENT_TEST_DATABASE_URL=... \
 *   SETTLEMENT_TEST_DB_ISOLATED=true \
 *   npx tsx --test lib/settlements/__tests__/postgres-settlement.test.ts
 */

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PrismaClient } from '@prisma/client';
import {
  POS_SETTLEMENT_RULES_VERSION,
  classifyConsignmentSaleTxn,
  consignmentSaleSourceKey,
  type SettlementSourceDraft,
} from '@/lib/settlements/source-snapshot';
import {
  assertSettlementDeletable,
  buildSettlementDraft,
  persistSettlementDraft,
  withdrawSettlementDraft,
  type SettlementDraft,
  type SettlementPaymentMethod,
  type SubmittedPreview,
} from '@/lib/settlements/write-settlement';
import {
  SETTLEMENT_INVALID_AMOUNT_ERROR,
  SETTLEMENT_VOID_STATE_ERROR,
  countVoidedAttempts,
  countsTowardValidTotals,
  hasSourceSnapshot,
  loadActiveSourceKeys,
  loadMerchantSettlementHistory,
  loadSettlementSnapshot,
} from '@/lib/settlements/read-snapshot';

// ---------------------------------------------------------------------------
// 正向白名單閘門
// ---------------------------------------------------------------------------

const TEST_DB_URL_ENV = 'SETTLEMENT_TEST_DATABASE_URL';
const TEST_DB_ISOLATED_ENV = 'SETTLEMENT_TEST_DB_ISOLATED';

/** 只放行本機。任何遠端主機（含 Supabase／Vercel）都不在白名單內。 */
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** 專用測試資料庫名必須自我標示，避免誤指到同一台 PostgreSQL 上的其他資料庫。 */
const ALLOWED_DB_NAME = /^[a-z0-9_]*settlement_test[a-z0-9_]*$/;

type DatabaseGate = { ok: true; url: string } | { ok: false; reason: string };

/**
 * 解析專用測試連線字串。
 *
 * 回傳的 reason 只描述哪一項白名單沒通過，永遠不含連線字串本身。
 */
export function resolveTestDatabase(
  env: Record<string, string | undefined> = process.env,
): DatabaseGate {
  const raw = env[TEST_DB_URL_ENV];
  if (raw == null || raw.trim() === '') {
    return { ok: false, reason: `未設定 ${TEST_DB_URL_ENV}` };
  }
  if (env[TEST_DB_ISOLATED_ENV] !== 'true') {
    return { ok: false, reason: `未設定 ${TEST_DB_ISOLATED_ENV}=true 明確確認這是隔離的專用測試庫` };
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: `${TEST_DB_URL_ENV} 不是合法的連線字串` };
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    return { ok: false, reason: '只接受 postgresql 連線' };
  }

  // URL 會把 IPv6 主機保留成 [::1]，比對前先脫括號。
  const host = parsed.hostname.replace(/^\[(.*)\]$/, '$1');
  if (!ALLOWED_HOSTS.has(host)) {
    return { ok: false, reason: '資料庫主機不在 loopback 白名單內' };
  }

  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!ALLOWED_DB_NAME.test(dbName)) {
    return {
      ok: false,
      reason: '資料庫名稱不在專用測試白名單內（名稱必須含 settlement_test）',
    };
  }

  // 正向白名單已經足夠，這裡再加一層保險：即使有人把正式連線字串複製過來，
  // 只要與 DATABASE_URL／DIRECT_URL 相同就拒絕。
  for (const key of ['DATABASE_URL', 'DIRECT_URL'] as const) {
    const other = env[key];
    if (other != null && other.trim() !== '' && other === raw) {
      return { ok: false, reason: `${TEST_DB_URL_ENV} 與 ${key} 相同，拒絕在該連線上執行測試` };
    }
  }

  return { ok: true, url: raw };
}

const gate = resolveTestDatabase();
/** 沒有隔離資料庫時如實標記未執行，不是靜默通過。 */
const skip = gate.ok ? false : `未執行（需要隔離的 PostgreSQL）：${gate.reason}`;

// ---------------------------------------------------------------------------
// 測試資料
// ---------------------------------------------------------------------------

const SUFFIX = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const PREFIX = `pgtest-${SUFFIX}`;

const PERIOD_START = new Date('2026-04-01T00:00:00.000Z');
const PERIOD_END = new Date('2026-04-30T23:59:59.999Z');

let prisma: PrismaClient;
let writeFlagBefore: string | undefined;

let merchantA = '';
let merchantB = '';
let productId = '';
let txnSeq = 0;

type SaleTxn = {
  id: string;
  txnNumber: string;
  quantity: number;
  unitPrice: number;
  commissionAmount: number;
  createdAt: Date;
};

async function createMerchant(label: string): Promise<string> {
  const row = await prisma.merchant.create({
    data: {
      merchantId: `MER-${PREFIX}-${label}`,
      name: `結算測試店家 ${label}`,
      type: 'consignment',
      commissionRate: 0.3,
      notes: PREFIX,
    },
    select: { id: true },
  });
  return row.id;
}

async function createSaleTxn(
  merchantId: string,
  input: { quantity: number; unitPrice: number; commissionAmount: number },
): Promise<SaleTxn> {
  txnSeq += 1;
  const row = await prisma.merchantStockTxn.create({
    data: {
      txnNumber: `MTXN-${PREFIX}-${String(txnSeq).padStart(4, '0')}`,
      merchantId,
      productId,
      type: 'sale',
      quantity: -input.quantity,
      balanceAfter: 0,
      unitPrice: input.unitPrice,
      commissionAmount: input.commissionAmount,
      companyRevenue: input.quantity * input.unitPrice - input.commissionAmount,
      createdAt: new Date('2026-04-10T03:00:00.000Z'),
      note: PREFIX,
    },
    select: { id: true, txnNumber: true, createdAt: true },
  });
  return {
    id: row.id,
    txnNumber: row.txnNumber,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    commissionAmount: input.commissionAmount,
    createdAt: row.createdAt,
  };
}

function sourceOf(txn: SaleTxn): SettlementSourceDraft {
  const classified = classifyConsignmentSaleTxn({
    id: txn.id,
    txnNumber: txn.txnNumber,
    type: 'sale',
    quantity: -txn.quantity,
    unitPrice: txn.unitPrice,
    commissionAmount: txn.commissionAmount,
    companyRevenue: txn.quantity * txn.unitPrice - txn.commissionAmount,
    orderId: null,
    orderNumber: null,
    productId,
    productName: '測試商品',
    createdAt: txn.createdAt,
  });
  if (classified.kind !== 'source') {
    throw new Error('測試資料應該是可認列來源，實際為待確認');
  }
  return classified.source;
}

function draftOf(
  merchantId: string,
  txns: SaleTxn[],
  options: { paymentMethod?: SettlementPaymentMethod; operationSeq?: number } = {},
): SettlementDraft {
  return buildSettlementDraft({
    merchantId,
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    intendedPaymentMethod: options.paymentMethod ?? 'BANK_TRANSFER',
    operationSeq: options.operationSeq ?? 0,
    sources: txns.map(sourceOf),
  });
}

/** 送出時由瀏覽器帶回的預覽指紋，這裡等同「畫面沒有變動」。 */
function submittedOf(draft: SettlementDraft): SubmittedPreview {
  return {
    sourceKeysDigest: draft.sourceKeysDigest,
    amountsDigest: draft.amountsDigest,
    idempotencyKey: draft.idempotencyKey,
    payloadFingerprint: draft.payloadFingerprint,
  };
}

async function countSettlements(merchantId: string): Promise<number> {
  return prisma.settlement.count({ where: { merchantId } });
}

// ---------------------------------------------------------------------------
// 曝險防護段：直接取用會上線的那份 migration SQL
// ---------------------------------------------------------------------------

const MIGRATION_URL = new URL(
  '../../../prisma/migrations/20260911160000_pos_settlement_sources/migration.sql',
  import.meta.url,
);

const GUARD_BEGIN = '-- ===== SETTLEMENT-SOURCE-ITEM-EXPOSURE-GUARD-BEGIN =====';
const GUARD_END = '-- ===== SETTLEMENT-SOURCE-ITEM-EXPOSURE-GUARD-END =====';

/**
 * 從實際出貨的 migration 取出曝險防護段。
 *
 * 測試執行的必須是會上線的那段 SQL，不是抄寫的副本；否則 migration 被改掉時
 * 測試還會繼續通過。
 */
function readExposureGuardSql(): string {
  const sql = readFileSync(MIGRATION_URL, 'utf8');
  const begin = sql.indexOf(GUARD_BEGIN);
  const end = sql.indexOf(GUARD_END);
  if (begin < 0 || end < 0 || end < begin) {
    throw new Error('migration.sql 缺少曝險防護段標記，新表會帶著 Supabase 預設權限上線');
  }
  return sql.slice(begin + GUARD_BEGIN.length, end).trim();
}

/**
 * 以分號切開語句，並跳過 `$tag$ ... $tag$` 與單引號字串內的內容。
 *
 * Prisma 的 `$executeRawUnsafe` 一次只能送一個語句，而防護段裡有 `DO $guard$` 區塊，
 * 不能用單純的 `split(';')`。
 */
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = '';
  let index = 0;
  let dollarTag: string | null = null;
  let inQuote = false;

  while (index < sql.length) {
    if (dollarTag != null) {
      if (sql.startsWith(dollarTag, index)) {
        buffer += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
      } else {
        buffer += sql[index];
        index += 1;
      }
      continue;
    }
    if (inQuote) {
      buffer += sql[index];
      if (sql[index] === "'") inQuote = false;
      index += 1;
      continue;
    }
    if (sql.startsWith('--', index)) {
      const lineEnd = sql.indexOf('\n', index);
      index = lineEnd < 0 ? sql.length : lineEnd + 1;
      continue;
    }
    const dollarOpen = /^\$[A-Za-z_]*\$/.exec(sql.slice(index, index + 64));
    if (dollarOpen != null) {
      dollarTag = dollarOpen[0];
      buffer += dollarTag;
      index += dollarTag.length;
      continue;
    }
    if (sql[index] === "'") {
      inQuote = true;
      buffer += sql[index];
      index += 1;
      continue;
    }
    if (sql[index] === ';') {
      if (buffer.trim() !== '') statements.push(buffer.trim());
      buffer = '';
      index += 1;
      continue;
    }
    buffer += sql[index];
    index += 1;
  }

  if (buffer.trim() !== '') statements.push(buffer.trim());
  return statements;
}

/** `$transaction` 回呼拿到的 client，這裡只需要 raw 介面。 */
type RawClient = Pick<PrismaClient, '$executeRawUnsafe' | '$queryRawUnsafe'>;

function readMigrationStatements(): string[] {
  return splitSqlStatements(readFileSync(MIGRATION_URL, 'utf8'));
}

/**
 * 不需要資料庫的靜態檢查，因此**刻意放在 skip 閘門外面**。
 *
 * 這份 migration 是唯一還沒正式套用的一份。若它沒有被單一交易包住，以 autocommit
 * 方式套用時 CREATE TABLE 會先 commit，在後面的 REVOKE 生效前就存在曝險空窗；
 * 中途失敗也會留下半套結構。
 */
describe('migration 交易包裝（靜態檢查）', () => {
  it('整份 migration 被單一 BEGIN/COMMIT 包住，防護段在建表之後、COMMIT 之前', () => {
    const statements = readMigrationStatements();

    assert.equal(statements.at(0), 'BEGIN', 'migration 第一個語句必須是 BEGIN');
    assert.equal(statements.at(-1), 'COMMIT', 'migration 最後一個語句必須是 COMMIT');
    assert.equal(
      statements.filter((statement) => /^BEGIN$/i.test(statement)).length,
      1,
      '只能有一組交易，不得中途再開新交易',
    );
    assert.equal(statements.filter((statement) => /^COMMIT$/i.test(statement)).length, 1);
    assert.equal(
      statements.filter((statement) => /^ROLLBACK$/i.test(statement)).length,
      0,
      'migration 內不得自行 ROLLBACK',
    );

    const createTableAt = statements.findIndex((statement) =>
      /CREATE TABLE IF NOT EXISTS "SettlementSourceItem"/i.test(statement),
    );
    const enableRlsAt = statements.findIndex((statement) =>
      /ALTER TABLE "SettlementSourceItem" ENABLE ROW LEVEL SECURITY/i.test(statement),
    );
    const revokeAt = statements.findIndex((statement) =>
      /REVOKE ALL ON TABLE "SettlementSourceItem" FROM PUBLIC/i.test(statement),
    );

    assert.ok(createTableAt > 0, '找不到新表的 CREATE TABLE');
    assert.ok(enableRlsAt > createTableAt, 'ENABLE RLS 必須排在 CREATE TABLE 之後');
    assert.ok(revokeAt > createTableAt, 'REVOKE 必須排在 CREATE TABLE 之後');
    assert.ok(
      enableRlsAt < statements.length - 1 && revokeAt < statements.length - 1,
      '防護段必須在 COMMIT 之前，否則建表與收權不在同一個交易',
    );

    // 這些語句不能在交易內執行；一旦混進來，整份 migration 會在套用時失敗。
    for (const statement of statements) {
      assert.doesNotMatch(statement, /\bINDEX\s+CONCURRENTLY\b/i);
      assert.doesNotMatch(statement, /\bVACUUM\b/i);
      assert.doesNotMatch(statement, /\bCREATE\s+DATABASE\b/i);
      assert.doesNotMatch(statement, /\bALTER\s+SYSTEM\b/i);
    }
  });
});

describe('真實 PostgreSQL 結算測試', { skip }, () => {
  before(async () => {
    const { PrismaClient: Client } = await import('@prisma/client');
    // 明確以專用連線字串建立 client。不經過 lib/prisma.ts，
    // 避免在測試裡意外連到 DATABASE_URL。
    prisma = new Client({
      datasources: { db: { url: gate.ok ? gate.url : '' } },
      log: [],
    }) as unknown as PrismaClient;
    await prisma.$connect();

    // 寫入 flag 是伺服器端開關，測試在自己的行程內打開，不影響任何部署環境。
    writeFlagBefore = process.env.POS_SETTLEMENT_WRITE_ENABLED;
    process.env.POS_SETTLEMENT_WRITE_ENABLED = 'true';

    merchantA = await createMerchant('a');
    merchantB = await createMerchant('b');
    const product = await prisma.product.create({
      data: {
        productId: `PROD-${PREFIX}`,
        sku: `SKU-${PREFIX}`,
        name: '測試商品',
        price: 100,
        notes: PREFIX,
      },
      select: { id: true },
    });
    productId = product.id;
  });

  after(async () => {
    if (prisma == null) return;
    try {
      // 刪除順序必須先來源明細再結算：兩個關聯都是 RESTRICT。
      for (const merchantId of [merchantA, merchantB].filter(Boolean)) {
        await prisma.settlementSourceItem.deleteMany({ where: { merchantId } });
        await prisma.merchantStockTxn.deleteMany({ where: { merchantId } });
        await prisma.settlement.deleteMany({ where: { merchantId } });
        await prisma.merchant.delete({ where: { id: merchantId } });
      }
      if (productId) await prisma.product.delete({ where: { id: productId } });
    } finally {
      if (writeFlagBefore == null) delete process.env.POS_SETTLEMENT_WRITE_ENABLED;
      else process.env.POS_SETTLEMENT_WRITE_ENABLED = writeFlagBefore;
      await prisma.$disconnect();
    }
  });

  describe('資料庫結構', () => {
    it('active canonical unique 是帶 voidedAt IS NULL 條件的 partial index', async () => {
      const rows = await prisma.$queryRawUnsafe<Array<{ indexdef: string }>>(
        `SELECT indexdef FROM pg_indexes
         WHERE tablename = 'SettlementSourceItem'
           AND indexname = 'SettlementSourceItem_active_source_key'`,
      );
      assert.equal(rows.length, 1, '缺少 active canonical unique index');
      const def = rows[0].indexdef;
      assert.match(def, /UNIQUE/i);
      assert.match(def, /"?merchantId"?/);
      assert.match(def, /"?sourceKey"?/);
      // 沒有 WHERE 條件就會變成「撤回後永遠不能重新結算」。
      assert.match(def, /WHERE .*voidedAt.* IS NULL/i);
    });

    it('Settlement 新版欄位有完整性 CHECK，半套資料會被資料庫擋下', async () => {
      const constraints = await prisma.$queryRawUnsafe<Array<{ conname: string }>>(
        `SELECT conname FROM pg_constraint
         WHERE conname = 'Settlement_rules_version_completeness_check'`,
      );
      assert.equal(constraints.length, 1, '缺少 rulesVersion 完整性 CHECK');

      await assert.rejects(
        prisma.settlement.create({
          data: {
            settlementId: `SET-${PREFIX}-HALF`,
            merchantId: merchantA,
            periodStart: PERIOD_START,
            periodEnd: PERIOD_END,
            grossSales: 100,
            commissionRate: 0.3,
            commissionAmount: 30,
            payable: 30,
            // 有 rulesVersion 卻缺 netPayableTwd／storeCollected：讀取端無法 fail closed，
            // 必須在資料庫層就拒絕。
            rulesVersion: POS_SETTLEMENT_RULES_VERSION,
            idempotencyKey: `${PREFIX}-half`,
            payloadFingerprint: `${PREFIX}-half`,
          },
        }),
      );
      assert.equal(await countSettlements(merchantA), 0, '被 CHECK 擋下不應留下殘列');
    });

    it('整份 migration 可在單一交易內重複套用，回滾後不留半套變更', async () => {
      // 過濾掉 BEGIN／COMMIT：Prisma 的 `$transaction` 已經開好交易，
      // 再送一個 COMMIT 會提早結束它，演練就證明不了整包回滾。
      // 交易邊界本身由上面的靜態檢查負責。
      const statements = readMigrationStatements().filter(
        (statement) => !/^(BEGIN|COMMIT)$/i.test(statement),
      );
      assert.ok(statements.length > 0, 'migration 沒有可執行語句');

      const sentinel = `migration-rehearsal-rollback-${PREFIX}`;
      await assert.rejects(
        prisma.$transaction(
          async (tx) => {
            for (const statement of statements) {
              await tx.$executeRawUnsafe(statement);
            }
            throw new Error(sentinel);
          },
          // ALTER TABLE 會取得 ACCESS EXCLUSIVE 鎖，給足時間避免誤判成超時。
          { timeout: 60_000, maxWait: 20_000 },
        ),
        (error: unknown) => {
          // 用訊息比對而不是 instanceof：Prisma 可能包裝掉原本的錯誤物件。
          assert.match(String((error as Error | null)?.message ?? error), new RegExp(sentinel));
          return true;
        },
      );

      // 整包能跑完才會走到 sentinel，代表每個語句都能在交易內執行且可重複套用。
      // 回滾後既有結構必須完好無缺。
      const state = await prisma.$queryRawUnsafe<Array<{ relrowsecurity: boolean }>>(
        `SELECT relrowsecurity FROM pg_class
         WHERE oid = 'public."SettlementSourceItem"'::regclass`,
      );
      assert.equal(state.length, 1, '回滾後新表應該仍然存在');
      assert.equal(state[0].relrowsecurity, true, '回滾後 RLS 仍必須是啟用狀態');
    });
  });

  describe('資料庫曝險防護（模擬 Supabase 預設權限）', () => {
    /** `has_table_privilege` 與 regclass 都要帶 schema 與大小寫。 */
    const REGCLASS = 'public."SettlementSourceItem"';
    const PUBLIC_ROLES = ['anon', 'authenticated'] as const;
    const WRITE_PRIVILEGES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;

    /** Prisma 一次只能送一個語句，依序執行。 */
    async function run(statements: readonly string[]): Promise<void> {
      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement);
      }
    }

    async function rowSecurityFlags(): Promise<{ enabled: boolean; forced: boolean }> {
      const rows = await prisma.$queryRawUnsafe<
        Array<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>
      >(
        `SELECT relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE oid = '${REGCLASS}'::regclass`,
      );
      assert.equal(rows.length, 1, '找不到 SettlementSourceItem，結構尚未套用');
      return { enabled: rows[0].relrowsecurity, forced: rows[0].relforcerowsecurity };
    }

    async function hasPrivilege(role: string, privilege: string): Promise<boolean> {
      const rows = await prisma.$queryRawUnsafe<Array<{ allowed: boolean }>>(
        `SELECT has_table_privilege('${role}', '${REGCLASS}', '${privilege}') AS allowed`,
      );
      return rows[0].allowed;
    }

    /** 真的切換成該角色去讀寫，證明「權限被收回」不只是 catalog 上的數字。 */
    async function assertRoleIsDenied(role: string): Promise<void> {
      const attempts: Array<{ label: string; execute: (tx: RawClient) => Promise<unknown> }> = [
        {
          label: `SELECT ${REGCLASS}`,
          execute: (tx) => tx.$queryRawUnsafe(`SELECT count(*) FROM "SettlementSourceItem"`),
        },
        {
          label: `INSERT ${REGCLASS}`,
          execute: (tx) =>
            tx.$executeRawUnsafe(`INSERT INTO "SettlementSourceItem" ("id") VALUES ('denied')`),
        },
      ];

      for (const attempt of attempts) {
        await assert.rejects(
          prisma.$transaction(async (tx) => {
            await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
            await attempt.execute(tx);
          }),
          (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error);
            assert.match(
              message,
              /permission denied|42501/i,
              `${role} 被擋下的原因不是權限不足：${message}`,
            );
            return true;
          },
          `${role} 仍然可以執行 ${attempt.label}`,
        );
      }
    }

    before(async () => {
      // 重現 Supabase 的角色拓樸：anon／authenticated 是 NOLOGIN NOINHERIT，
      // 而連線用的 postgres 是它們的成員（PostgREST 靠 SET ROLE 切換）。
      // 這些只發生在隔離測試庫，migration 本身不建立任何角色。
      await run([
        `DO $sim$
         BEGIN
           IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
             CREATE ROLE anon NOLOGIN NOINHERIT;
           END IF;
           IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
             CREATE ROLE authenticated NOLOGIN NOINHERIT;
           END IF;
         END
         $sim$`,
        `GRANT anon TO CURRENT_USER`,
        `GRANT authenticated TO CURRENT_USER`,
        `GRANT USAGE ON SCHEMA public TO anon, authenticated`,
      ]);
    });

    after(async () => {
      // 這個 describe 結束時，隔離庫一定停在「已防護」狀態。
      await run(splitSqlStatements(readExposureGuardSql()));
    });

    it('出貨的 migration 帶有防護段，且沒有 FORCE RLS、policy 或全域權限改動', () => {
      const guard = readExposureGuardSql();

      assert.match(guard, /ALTER TABLE "SettlementSourceItem" ENABLE ROW LEVEL SECURITY/i);
      assert.match(guard, /REVOKE ALL ON TABLE "SettlementSourceItem" FROM PUBLIC/i);
      assert.match(guard, /REVOKE ALL ON TABLE "SettlementSourceItem" FROM anon/i);
      assert.match(guard, /REVOKE ALL ON TABLE "SettlementSourceItem" FROM authenticated/i);
      // 隔離庫沒有這些角色，缺角色不得讓整份 migration 失敗。
      assert.match(guard, /pg_roles/i);

      // FORCE 會讓表擁有者（＝伺服器連線角色）自己也讀不到資料。
      assert.doesNotMatch(guard, /FORCE ROW LEVEL SECURITY/i);
      // 無 policy 才是全拒；新增任何 policy 就等於開了一個公開讀取面。
      assert.doesNotMatch(guard, /CREATE POLICY/i);
      // 全域預設權限、schema 權限與既有表都不在本包範圍。
      assert.doesNotMatch(guard, /ALTER DEFAULT PRIVILEGES/i);
      assert.doesNotMatch(guard, /ON SCHEMA/i);
      assert.doesNotMatch(guard, /"Settlement"/);

      assert.equal(splitSqlStatements(guard).length, 3, '防護段語句數量與預期不同');
    });

    it('模擬 Supabase 預設授權後，防護段讓 anon／authenticated 讀不到也寫不進新表', async () => {
      try {
        await run([
          // 這一行就是 ALTER DEFAULT PRIVILEGES 在 CREATE TABLE 當下造成的結果。
          `GRANT ALL ON TABLE "SettlementSourceItem" TO anon, authenticated`,
          `ALTER TABLE "SettlementSourceItem" DISABLE ROW LEVEL SECURITY`,
        ]);

        // 先證明漏洞真的被重現，否則後面的「通過」沒有意義。
        assert.equal(await hasPrivilege('anon', 'SELECT'), true, '模擬失敗：anon 沒有取得授權');
        assert.equal((await rowSecurityFlags()).enabled, false, '模擬失敗：RLS 沒有被關掉');
      } finally {
        // 無論上面成敗，都要用出貨的那段 SQL 回到有防護的狀態。
        await run(splitSqlStatements(readExposureGuardSql()));
      }

      const flags = await rowSecurityFlags();
      assert.equal(flags.enabled, true, 'RLS 未啟用');
      assert.equal(flags.forced, false, 'FORCE RLS 會讓伺服器自己讀不到資料');

      const policies = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
        `SELECT count(*)::int AS total FROM pg_policies
         WHERE schemaname = 'public' AND tablename = 'SettlementSourceItem'`,
      );
      assert.equal(policies[0].total, 0, '新表不得有任何 policy');

      for (const role of PUBLIC_ROLES) {
        for (const privilege of WRITE_PRIVILEGES) {
          assert.equal(await hasPrivilege(role, privilege), false, `${role} 仍有 ${privilege} 權限`);
        }
      }

      await assertRoleIsDenied('anon');
      await assertRoleIsDenied('authenticated');
    });

    it('伺服器交易在 RLS 啟用後仍可用，且誤下 GRANT 時 RLS 仍讓 anon 讀不到任何一列', async () => {
      const txn = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 100,
        commissionAmount: 30,
      });
      const draft = draftOf(merchantA, [txn]);
      const created = await persistSettlementDraft(prisma, draft, submittedOf(draft));
      assert.equal(created.ok, true, 'RLS 啟用後伺服器仍必須寫得進去');
      if (!created.ok) return;
      assert.equal(
        await prisma.settlementSourceItem.count({ where: { settlementId: created.id } }),
        1,
        '伺服器讀不到自己剛寫入的來源明細，代表連線角色不是表擁有者',
      );

      // 後備層驗證：就算日後有人誤下 GRANT，無 policy 的 RLS 仍然全拒。
      try {
        await prisma.$executeRawUnsafe(`GRANT SELECT ON TABLE "SettlementSourceItem" TO anon`);
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL ROLE anon`);
          const rows = await tx.$queryRawUnsafe<Array<{ total: number }>>(
            `SELECT count(*)::int AS total FROM "SettlementSourceItem"`,
          );
          assert.equal(rows[0].total, 0, 'RLS 後備層失效：anon 讀到了資料列');
        });
      } finally {
        // 斷言失敗也不能把臨時授權留在資料庫裡。
        await prisma.$executeRawUnsafe(`REVOKE SELECT ON TABLE "SettlementSourceItem" FROM anon`);
      }

      assert.equal(await hasPrivilege('anon', 'SELECT'), false, '臨時 GRANT 沒有被收回');

      await cleanupMerchant(merchantA);
    });
  });

  describe('舊流程回歸', () => {
    it('legacy 結算五個新欄位全為 null 時可建立、可刪除，行為不變', async () => {
      const legacy = await prisma.settlement.create({
        data: {
          settlementId: `SET-${PREFIX}-LEGACY`,
          merchantId: merchantA,
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          grossSales: 1000,
          commissionRate: 0.3,
          commissionAmount: 300,
          payable: 300,
          merchantOwesUs: 700,
        },
        select: { id: true, rulesVersion: true, netPayableTwd: true },
      });

      assert.equal(legacy.rulesVersion, null);
      assert.equal(legacy.netPayableTwd, null);
      assert.equal(hasSourceSnapshot(legacy.rulesVersion), false, 'legacy 不得走快照分支');

      // legacy 沒有來源明細，刪除守衛不得誤擋既有流程。
      assert.doesNotThrow(() =>
        assertSettlementDeletable({ rulesVersion: legacy.rulesVersion, sourceItemCount: 0 }),
      );
      await prisma.settlement.delete({ where: { id: legacy.id } });
      assert.equal(await countSettlements(merchantA), 0);
    });
  });

  describe('POS 送出待核對草稿', () => {
    it('只建立 draft、不寫 paidAt，半元在唯一一次進位後落在整數淨額', async () => {
      // 255 − 76.5 = 178.5 → 179。半元不得在中途被抹掉。
      const txn = await createSaleTxn(merchantA, {
        quantity: 3,
        unitPrice: 85,
        commissionAmount: 76.5,
      });
      const draft = draftOf(merchantA, [txn]);

      const result = await persistSettlementDraft(prisma, draft, submittedOf(draft));
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.duplicate, false);
      assert.equal(result.status, 'draft');
      assert.equal(result.netPayableTwd, 179);

      const row = await prisma.settlement.findUniqueOrThrow({
        where: { id: result.id },
        select: {
          status: true,
          paidAt: true,
          createdSource: true,
          rulesVersion: true,
          netPayableTwd: true,
          storeCollected: true,
          commissionAmount: true,
          grossSales: true,
        },
      });
      assert.equal(row.paidAt, null, 'POS 不得標記已付款');
      assert.equal(row.createdSource, 'pos');
      assert.equal(row.rulesVersion, POS_SETTLEMENT_RULES_VERSION);
      assert.equal(row.netPayableTwd, 179);
      assert.equal(row.storeCollected, 0);
      assert.equal(row.commissionAmount, 76.5, '來源原值的半元必須原樣保存');
      assert.equal(row.grossSales, 255);

      const items = await prisma.settlementSourceItem.findMany({
        where: { settlementId: result.id },
        select: { sourceKey: true, originalAmount: true, voidedAt: true, rulesVersion: true },
      });
      assert.equal(items.length, 1);
      assert.equal(items[0].sourceKey, consignmentSaleSourceKey(txn.id));
      assert.equal(items[0].originalAmount, 255);
      assert.equal(items[0].voidedAt, null);
      assert.equal(items[0].rulesVersion, POS_SETTLEMENT_RULES_VERSION);

      const locked = await prisma.merchantStockTxn.findUniqueOrThrow({
        where: { id: txn.id },
        select: { settlementId: true },
      });
      assert.equal(locked.settlementId, result.id, '寄賣流水必須被鎖到這張結算');

      // 讀取走已存快照，不重算，整數淨額與寫入完全一致。
      const snapshot = await loadSettlementSnapshot(prisma, result.id);
      assert.equal(snapshot.ok, true);
      if (!snapshot.ok) return;
      assert.equal(snapshot.view.netPayableTwd, 179);
      assert.equal(snapshot.view.withdrawn, false);
      assert.equal(snapshot.view.activeSources.length, 1);

      await cleanupMerchant(merchantA);
    });
  });

  describe('並行與衝突', () => {
    it('同 key 並行只收斂出一張結算，另一邊回傳既有單', async () => {
      const txn = await createSaleTxn(merchantA, {
        quantity: 2,
        unitPrice: 100,
        commissionAmount: 60,
      });
      const draft = draftOf(merchantA, [txn]);

      const [first, second] = await Promise.all([
        persistSettlementDraft(prisma, draft, submittedOf(draft)),
        persistSettlementDraft(prisma, draft, submittedOf(draft)),
      ]);

      assert.equal(first.ok, true);
      assert.equal(second.ok, true);
      if (!first.ok || !second.ok) return;
      assert.equal(first.id, second.id, '同 key 必須收斂到同一張');
      assert.equal(
        [first.duplicate, second.duplicate].filter((flag) => flag === false).length,
        1,
        '只能有一邊是新建立',
      );
      assert.equal(await countSettlements(merchantA), 1);
      assert.equal(
        await prisma.settlementSourceItem.count({ where: { merchantId: merchantA } }),
        1,
        '來源明細不得寫兩份',
      );

      await cleanupMerchant(merchantA);
    });

    it('同 key 不同 payload 一律拒絕，不覆蓋也不另建', async () => {
      const txn = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 200,
        commissionAmount: 60,
      });
      const draft = draftOf(merchantA, [txn]);
      const created = await persistSettlementDraft(prisma, draft, submittedOf(draft));
      assert.equal(created.ok, true);

      // 偽造同 key、不同 payload 的重送。正常流程算不出這種組合，
      // 但被篡改或程式回歸時必須擋下。
      const tampered: SettlementDraft = { ...draft, payloadFingerprint: `${draft.payloadFingerprint}-x` };
      const conflict = await persistSettlementDraft(prisma, tampered, {
        sourceKeysDigest: tampered.sourceKeysDigest,
        amountsDigest: tampered.amountsDigest,
      });
      assert.equal(conflict.ok, false);
      if (conflict.ok) return;
      assert.equal(conflict.code, 'PAYLOAD_CONFLICT');
      assert.equal(await countSettlements(merchantA), 1);

      await cleanupMerchant(merchantA);
    });

    it('來源部分重疊整批拒絕，失敗後零殘留', async () => {
      const shared = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 300,
        commissionAmount: 90,
      });
      const extra = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 150,
        commissionAmount: 45,
      });

      const first = draftOf(merchantA, [shared]);
      const ok = await persistSettlementDraft(prisma, first, submittedOf(first));
      assert.equal(ok.ok, true);

      const settlementsBefore = await countSettlements(merchantA);
      const itemsBefore = await prisma.settlementSourceItem.count({
        where: { merchantId: merchantA },
      });

      // 第二張含同一筆已鎖來源加一筆新來源；付款方式不同所以 key 不同，
      // 必須由 active canonical unique 擋下，而且整批不得留下任何一列。
      const second = draftOf(merchantA, [shared, extra], { paymentMethod: 'FURMOSA_BALANCE' });
      const conflict = await persistSettlementDraft(prisma, second, submittedOf(second));
      assert.equal(conflict.ok, false);
      if (conflict.ok) return;
      assert.equal(conflict.code, 'SOURCE_CONFLICT');

      assert.equal(await countSettlements(merchantA), settlementsBefore, '不得留下第二張 header');
      assert.equal(
        await prisma.settlementSourceItem.count({ where: { merchantId: merchantA } }),
        itemsBefore,
        '不得留下半套來源明細',
      );
      const untouched = await prisma.merchantStockTxn.findUniqueOrThrow({
        where: { id: extra.id },
        select: { settlementId: true },
      });
      assert.equal(untouched.settlementId, null, '整批拒絕後新來源不得被鎖');

      await cleanupMerchant(merchantA);
    });

    it('銷售流水在送出同時被別張鎖走時整批回滾（失敗注入）', async () => {
      const txn = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 400,
        commissionAmount: 120,
      });
      const draft = draftOf(merchantA, [txn]);

      // 注入 HQ 先鎖走同一筆流水的情況：legacy 結算佔住 settlementId。
      const hq = await prisma.settlement.create({
        data: {
          settlementId: `SET-${PREFIX}-HQ`,
          merchantId: merchantA,
          periodStart: PERIOD_START,
          periodEnd: PERIOD_END,
          grossSales: 400,
          commissionRate: 0.3,
          commissionAmount: 120,
          payable: 120,
        },
        select: { id: true },
      });
      await prisma.merchantStockTxn.update({
        where: { id: txn.id },
        data: { settlementId: hq.id },
      });

      const result = await persistSettlementDraft(prisma, draft, submittedOf(draft));
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.code, 'LOCK_CONFLICT');

      assert.equal(await countSettlements(merchantA), 1, '只應剩下 HQ 那張');
      assert.equal(
        await prisma.settlementSourceItem.count({ where: { merchantId: merchantA } }),
        0,
        '鎖定斷言失敗必須讓整個交易回滾',
      );
      const still = await prisma.merchantStockTxn.findUniqueOrThrow({
        where: { id: txn.id },
        select: { settlementId: true },
      });
      assert.equal(still.settlementId, hq.id, '不得搶走別張已有的鎖');

      await cleanupMerchant(merchantA);
    });

    it('不同店家可以有相同 sourceKey，且不會讀到別家店的結算', async () => {
      const txnA = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 100,
        commissionAmount: 30,
      });
      const draftA = draftOf(merchantA, [txnA]);
      const createdA = await persistSettlementDraft(prisma, draftA, submittedOf(draftA));
      assert.equal(createdA.ok, true);

      const txnB = await createSaleTxn(merchantB, {
        quantity: 1,
        unitPrice: 100,
        commissionAmount: 30,
      });
      const draftB = draftOf(merchantB, [txnB]);
      const createdB = await persistSettlementDraft(prisma, draftB, submittedOf(draftB));
      assert.equal(createdB.ok, true, '唯一鍵是每店獨立的，不得跨店互斥');

      // B 店送出時帶著 A 店的 key：不得回傳 A 店的結算。
      const crossStore = await persistSettlementDraft(prisma, draftB, {
        ...submittedOf(draftB),
        idempotencyKey: draftA.idempotencyKey,
      });
      assert.equal(crossStore.ok, true);
      if (!crossStore.ok || !createdA.ok || !createdB.ok) return;
      assert.notEqual(crossStore.id, createdA.id, '不得跨店讀到別家店的結算');
      assert.equal(crossStore.id, createdB.id);

      await cleanupMerchant(merchantA);
      await cleanupMerchant(merchantB);
    });
  });

  describe('撤回、狀態競態與重新結算', () => {
    it('撤回保留稽核並釋放唯一鍵，舊 key 重送不復活，新操作可重新結算', async () => {
      const txn = await createSaleTxn(merchantA, {
        quantity: 3,
        unitPrice: 85,
        commissionAmount: 76.5,
      });
      const first = draftOf(merchantA, [txn]);
      const created = await persistSettlementDraft(prisma, first, submittedOf(first));
      assert.equal(created.ok, true);
      if (!created.ok) return;

      const sourceKey = consignmentSaleSourceKey(txn.id);
      const lockedBefore = await loadActiveSourceKeys(prisma, merchantA, [sourceKey]);
      assert.equal(lockedBefore.lockedKeys.has(sourceKey), true, '送出後來源必須是已鎖定');

      // 兩次同時撤回：只有一次成功，另一次必須是不可撤回而不是報錯或重複作廢。
      const [w1, w2] = await Promise.all([
        withdrawSettlementDraft(prisma, { merchantId: merchantA, settlementId: created.id }),
        withdrawSettlementDraft(prisma, { merchantId: merchantA, settlementId: created.id }),
      ]);
      const withdrawOutcome = [w1, w2].map((r) => (r.ok ? 'ok' : r.code));
      assert.equal(
        withdrawOutcome.filter((code) => code === 'ok').length,
        1,
        '撤回必須是整張一次性的操作',
      );
      assert.equal(
        withdrawOutcome.filter((code) => code === 'NOT_WITHDRAWABLE').length,
        1,
        '第二次撤回必須明確拒絕，不是重複作廢',
      );

      const afterWithdraw = await prisma.settlement.findUniqueOrThrow({
        where: { id: created.id },
        select: { status: true, netPayableTwd: true },
      });
      assert.equal(afterWithdraw.status, 'cancelled');
      assert.equal(afterWithdraw.netPayableTwd, 179, '撤回不得把歷史金額清零');
      assert.equal(countsTowardValidTotals('cancelled'), false);

      const audit = await prisma.settlementSourceItem.findMany({
        where: { settlementId: created.id },
        select: { voidedAt: true },
      });
      assert.equal(audit.length, 1, '稽核列必須保留');
      assert.notEqual(audit[0].voidedAt, null, '撤回必須全列標記作廢');

      const lockedAfter = await loadActiveSourceKeys(prisma, merchantA, [sourceKey]);
      assert.equal(lockedAfter.lockedKeys.has(sourceKey), false, '撤回必須釋放 active 唯一鍵');
      const released = await prisma.merchantStockTxn.findUniqueOrThrow({
        where: { id: txn.id },
        select: { settlementId: true },
      });
      assert.equal(released.settlementId, null);

      // 撤回後的快照仍可讀，且不因明細被作廢而判為損毀。
      const cancelledView = await loadSettlementSnapshot(prisma, created.id);
      assert.equal(cancelledView.ok, true);
      if (cancelledView.ok) {
        assert.equal(cancelledView.view.withdrawn, true);
        assert.equal(cancelledView.view.netPayableTwd, 179);
        assert.equal(cancelledView.view.activeSources.length, 0);
        assert.equal(cancelledView.view.auditSources.length, 1);
      }

      // HQ 不得把已撤回的結算推回流程。條件在資料庫，不靠 UI 隱藏按鈕。
      const revive = await prisma.settlement.updateMany({
        where: { id: created.id, status: { not: 'cancelled' } },
        data: { status: 'reviewing' },
      });
      assert.equal(revive.count, 0, '已撤回不得被推進狀態');

      // 舊 key 重送仍回到原本那張 cancelled，不建立第二張。
      const resend = await persistSettlementDraft(prisma, first, submittedOf(first));
      assert.equal(resend.ok, true);
      if (resend.ok) {
        assert.equal(resend.duplicate, true);
        assert.equal(resend.id, created.id);
        assert.equal(resend.status, 'cancelled');
      }
      assert.equal(await countSettlements(merchantA), 1);

      // 新操作序號由伺服器推導，撤回後可重新結算同一批來源。
      const seq = await countVoidedAttempts(prisma, merchantA, [sourceKey]);
      assert.equal(seq.available, true);
      assert.equal(seq.operationSeq, 1);

      const second = draftOf(merchantA, [txn], { operationSeq: seq.operationSeq });
      assert.notEqual(second.idempotencyKey, first.idempotencyKey, '新操作必須產生新 key');
      const recreated = await persistSettlementDraft(prisma, second, submittedOf(second));
      assert.equal(recreated.ok, true);
      if (!recreated.ok) return;
      assert.equal(recreated.duplicate, false);
      assert.notEqual(recreated.id, created.id);
      assert.equal(recreated.netPayableTwd, 179);

      const history = await loadMerchantSettlementHistory(prisma, merchantA);
      assert.equal(history.available, true);
      assert.equal(history.rows.length, 2, '重新結算不得覆蓋撤回歷史');
      assert.equal(
        history.rows.filter((row) => row.countsTowardValidTotals).length,
        1,
        '只有有效那張計入有效統計',
      );

      await cleanupMerchant(merchantA);
    });

    it('送出後來源被排除、序號變動時，重送仍依原 key 回到原單', async () => {
      const txn = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 500,
        commissionAmount: 150,
      });
      const draft = draftOf(merchantA, [txn]);
      const created = await persistSettlementDraft(prisma, draft, submittedOf(draft));
      assert.equal(created.ok, true);
      if (!created.ok) return;

      // 送出成功後預覽會把已鎖來源排除，重算出的草稿是空的。
      // 若不先用原 key 查原單，重按一次就會變成「沒有可結算項目」。
      const emptyDraft = draftOf(merchantA, [], { operationSeq: 7 });
      const resend = await persistSettlementDraft(prisma, emptyDraft, {
        sourceKeysDigest: emptyDraft.sourceKeysDigest,
        amountsDigest: emptyDraft.amountsDigest,
        idempotencyKey: draft.idempotencyKey,
        payloadFingerprint: draft.payloadFingerprint,
      });
      assert.equal(resend.ok, true);
      if (resend.ok) {
        assert.equal(resend.duplicate, true);
        assert.equal(resend.id, created.id);
      }
      assert.equal(await countSettlements(merchantA), 1, '重送不得另建第二張');

      await cleanupMerchant(merchantA);
    });
  });

  describe('稽核保留與快照完整性', () => {
    it('帶來源明細的結算與店家都不能被刪除（ON DELETE RESTRICT）', async () => {
      const txn = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 100,
        commissionAmount: 30,
      });
      const draft = draftOf(merchantA, [txn]);
      const created = await persistSettlementDraft(prisma, draft, submittedOf(draft));
      assert.equal(created.ok, true);
      if (!created.ok) return;

      await assert.rejects(
        prisma.settlement.delete({ where: { id: created.id } }),
        '帶來源明細的結算不得被刪除',
      );
      await assert.rejects(
        prisma.merchant.delete({ where: { id: merchantA } }),
        '刪店家不得連帶刪掉帳務稽核列',
      );

      assert.equal(await countSettlements(merchantA), 1);
      assert.equal(
        await prisma.settlementSourceItem.count({ where: { settlementId: created.id } }),
        1,
      );

      // 應用層守衛必須在資料庫報錯之前給出可讀訊息。
      assert.throws(
        () =>
          assertSettlementDeletable({
            rulesVersion: POS_SETTLEMENT_RULES_VERSION,
            sourceItemCount: 1,
          }),
        /保留稽核/,
      );

      await cleanupMerchant(merchantA);
    });

    it('draft 卻有部分明細被作廢時 fail closed，不照 header 顯示金額', async () => {
      const one = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 100,
        commissionAmount: 30,
      });
      const two = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 200,
        commissionAmount: 60,
      });
      const draft = draftOf(merchantA, [one, two]);
      const created = await persistSettlementDraft(prisma, draft, submittedOf(draft));
      assert.equal(created.ok, true);
      if (!created.ok) return;

      const items = await prisma.settlementSourceItem.findMany({
        where: { settlementId: created.id },
        select: { id: true },
        orderBy: { sourceKey: 'asc' },
      });
      // 注入半套改動：draft 只有一列被作廢，違反「撤回是整張」。
      await prisma.settlementSourceItem.update({
        where: { id: items[0].id },
        data: { voidedAt: new Date() },
      });

      const broken = await loadSettlementSnapshot(prisma, created.id);
      assert.equal(broken.ok, false);
      if (!broken.ok) {
        assert.equal(broken.error, SETTLEMENT_VOID_STATE_ERROR);
      }

      await cleanupMerchant(merchantA);
    });

    it('來源原值被外部改成極大值時回傳可讀錯誤，不是 500', async () => {
      const txn = await createSaleTxn(merchantA, {
        quantity: 1,
        unitPrice: 100,
        commissionAmount: 30,
      });
      const draft = draftOf(merchantA, [txn]);
      const created = await persistSettlementDraft(prisma, draft, submittedOf(draft));
      assert.equal(created.ok, true);
      if (!created.ok) return;

      // 每一列都還是有限數值（過得了逐列檢查），但加總後超出整數台幣範圍。
      // 這是 originalAmount 為 DOUBLE PRECISION 而 netPayableTwd 為 INTEGER 的真實落差。
      await prisma.settlementSourceItem.updateMany({
        where: { settlementId: created.id },
        data: { originalAmount: 4e9 },
      });

      const overflow = await loadSettlementSnapshot(prisma, created.id);
      assert.equal(overflow.ok, false);
      if (!overflow.ok) {
        assert.equal(overflow.error, SETTLEMENT_INVALID_AMOUNT_ERROR);
      }

      await cleanupMerchant(merchantA);
    });
  });
});

/** 清掉本店在這個案例裡建立的資料，讓每個案例互相獨立。 */
async function cleanupMerchant(merchantId: string): Promise<void> {
  await prisma.settlementSourceItem.deleteMany({ where: { merchantId } });
  await prisma.merchantStockTxn.updateMany({
    where: { merchantId },
    data: { settlementId: null },
  });
  await prisma.settlement.deleteMany({ where: { merchantId } });
  await prisma.merchantStockTxn.deleteMany({ where: { merchantId } });
}
