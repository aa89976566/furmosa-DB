import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  decideFinanceAccess,
  evaluateFinanceDbRole,
  scopedMerchantId,
} from '@/lib/finance/access-policy';
import { FinanceAccessError } from '@/lib/finance/guard';
import { updateCashPlan, updateProductCosts, type FinanceWriteDb } from '@/lib/finance/mutations';

describe('財務權限', () => {
  it('直接網址與 API 只放行最高權限 admin', () => {
    for (const pathname of ['/finance/products', '/finance/cash-flow', '/api/finance/products']) {
      assert.equal(decideFinanceAccess({ pathname, hasHqSession: false, role: null }), 'login');
      for (const role of ['staff', 'finance', 'warehouse', 'pos']) {
        assert.equal(decideFinanceAccess({ pathname, hasHqSession: true, role }), 'forbid');
      }
      assert.equal(decideFinanceAccess({ pathname, hasHqSession: true, role: 'admin' }), 'allow');
    }
    assert.equal(decideFinanceAccess({ pathname: '/orders', hasHqSession: true, role: 'staff' }), 'allow');
    assert.equal(evaluateFinanceDbRole({ hasSession: true, dbRole: 'admin' }), 'allow');
    assert.equal(evaluateFinanceDbRole({ hasSession: true, dbRole: 'finance' }), 'forbid');
    assert.equal(evaluateFinanceDbRole({ hasSession: false, dbRole: 'admin' }), 'login');
  });

  it('middleware 對非 admin 回 403，頁面與 API 會再檢查資料庫角色', () => {
    const middleware = readFileSync('middleware.ts', 'utf8');
    assert.match(middleware, /decideFinanceAccess/);
    assert.match(middleware, /status: 403/);
    for (const file of [
      'app/(main)/finance/layout.tsx',
      'app/api/finance/products/route.ts',
      'app/api/finance/channels/route.ts',
      'app/api/finance/partners/route.ts',
      'app/api/finance/cash-flow/route.ts',
      'lib/finance/queries.ts',
    ]) {
      const source = readFileSync(file, 'utf8');
      assert.match(source, /requireFinanceAdmin|financeGet|financePost/);
    }
    const queries = readFileSync('lib/finance/queries.ts', 'utf8');
    assert.match(queries, /requireFinanceAdmin/);
    assert.doesNotMatch(queries, /select:\s*\{[^}]*\bcost\b/);
  });

  it('一般 HQ 角色不能寫成本，也不會留下稽核', async () => {
    let writes = 0;
    const db = fakeDb(() => {
      writes += 1;
    });
    await assert.rejects(
      () => updateProductCosts(
        { productId: 'p1', foodCost: '10', packagingCost: '1' },
        { requireFinanceAdmin: async () => { throw new FinanceAccessError(); }, db },
      ),
      FinanceAccessError,
    );
    assert.equal(writes, 0);
  });

  it('admin 更新成本會驗證輸入並寫稽核，空白保持 null', async () => {
    const seen: unknown[] = [];
    const db = fakeDb((kind) => seen.push(kind));
    const ok = await updateProductCosts(
      { productId: 'p1', foodCost: '', packagingCost: '0' },
      { requireFinanceAdmin: async () => ({ userId: 'admin-1' }), db },
    );
    assert.equal(ok.ok, true);
    assert.deepEqual(seen, ['update', 'audit']);
    assert.deepEqual(db.updated, {
      foodCostCents: null,
      packagingCostCents: 0,
    });
    const bad = await updateProductCosts(
      { productId: 'p1', foodCost: '-5', packagingCost: '1' },
      { requireFinanceAdmin: async () => ({ userId: 'admin-1' }), db },
    );
    assert.equal(bad.ok, false);
  });

  it('現金流缺少一週時 admin 也不能存成 0', async () => {
    const db = fakeDb(() => undefined);
    const result = await updateCashPlan(
      {
        openingBalance: '',
        minimumCash: '1000',
        weeks: Array.from({ length: 12 }, () => ({
          inflow: null,
          supplierPayment: null,
          packaging: null,
          payroll: null,
          ads: null,
          logistics: null,
          sampling: null,
        })),
      },
      { requireFinanceAdmin: async () => ({ userId: 'admin-1' }), db },
    );
    assert.equal(result.ok, false);
  });

  it('店家不能改看別店', () => {
    assert.equal(scopedMerchantId('store-a', 'store-b'), 'store-a');
    assert.equal(scopedMerchantId('store-a', null), 'store-a');
  });
});

function fakeDb(onWrite: (kind: string) => void): FinanceWriteDb & {
  updated: { foodCostCents: number | null; packagingCostCents: number | null } | null;
} {
  const db = {
    updated: null as { foodCostCents: number | null; packagingCostCents: number | null } | null,
    product: {
      findUnique: async () => ({ id: 'p1', foodCostCents: null, packagingCostCents: 100 }),
      update: async (args: { data: { foodCostCents: number | null; packagingCostCents: number | null } }) => {
        db.updated = args.data;
        onWrite('update');
      },
    },
    financeAuditLog: {
      create: async () => {
        onWrite('audit');
      },
    },
    financeMarginSettings: { findUnique: async () => null, upsert: async () => undefined },
    financeSkuChannelCost: { findUnique: async () => null, upsert: async () => undefined },
    financeCashPlan: {
      findUnique: async () => null,
      upsert: async () => ({ id: 'default' }),
    },
    financeCashWeek: { deleteMany: async () => undefined, createMany: async () => undefined },
    $transaction: async <T,>(fn: (tx: FinanceWriteDb) => Promise<T>): Promise<T> => fn(db),
  };
  return db;
}
