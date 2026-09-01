import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { resolveMerchantIdForQuery } from '@/lib/merchant-auth/access';
import {
  buildMerchantRestockInStoreIds,
  isMerchantRestockCatalogEligible,
  merchantRestockSubmitEligibility,
} from '@/lib/restock-request/catalog-eligibility';
import {
  listMerchantRestockCatalog,
  submitSelfSelectRestockRequest,
  type SubmitSelfSelectDb,
} from '@/lib/restock-request/service';

type ProductRow = {
  id: string;
  name: string;
  unit: string;
  status: string;
  productCategory: string;
};

type StockRow = { merchantId: string; productId: string; quantity: number };
type RuleRow = { merchantId: string; productId: string };

type MemoryState = {
  products: ProductRow[];
  stocks: StockRow[];
  rules: RuleRow[];
  creates: number;
};

function matchesProductWhere(
  row: ProductRow,
  where: {
    id?: { in: string[] };
    status?: string;
    productCategory?: { in: string[] };
  },
) {
  if (where.id?.in && !where.id.in.includes(row.id)) return false;
  if (where.status && row.status !== where.status) return false;
  if (where.productCategory?.in && !where.productCategory.in.includes(row.productCategory)) {
    return false;
  }
  return true;
}

function matchesMerchantRow(
  row: { merchantId: string; productId: string },
  where: { merchantId: string; productId?: { in: string[] } },
) {
  if (row.merchantId !== where.merchantId) return false;
  if (where.productId?.in && !where.productId.in.includes(row.productId)) return false;
  return true;
}

function createMemorySubmitDb(seed: {
  products: ProductRow[];
  stocks?: StockRow[];
  rules?: RuleRow[];
}): SubmitSelfSelectDb & { state: MemoryState } {
  const state: MemoryState = {
    products: seed.products.map((row) => ({ ...row })),
    stocks: (seed.stocks ?? []).map((row) => ({ ...row })),
    rules: (seed.rules ?? []).map((row) => ({ ...row })),
    creates: 0,
  };

  const db = {
    state,
    product: {
      async findMany({
        where,
      }: {
        where: {
          id?: { in: string[] };
          status?: string;
          productCategory?: { in: string[] };
        };
      }) {
        return state.products.filter((row) => matchesProductWhere(row, where));
      },
    },
    merchantStock: {
      async findMany({
        where,
      }: {
        where: { merchantId: string; productId?: { in: string[] } };
      }) {
        return state.stocks.filter((row) => matchesMerchantRow(row, where));
      },
    },
    merchantProductRule: {
      async findMany({
        where,
      }: {
        where: { merchantId: string; productId?: { in: string[] } };
      }) {
        return state.rules.filter((row) => matchesMerchantRow(row, where));
      },
    },
    restockRequest: {
      async create() {
        state.creates += 1;
        return {
          id: `req-${state.creates}`,
          items: [],
        };
      },
    },
  };

  return db as SubmitSelfSelectDb & { state: MemoryState };
}

const STORE_A = 'merchant-a';
const STORE_B = 'merchant-b';

const standardInA: ProductRow = {
  id: 'std-a',
  name: '寄賣零食',
  unit: '包',
  status: 'active',
  productCategory: 'STANDARD',
};
const jarActive: ProductRow = {
  id: 'jar-1',
  name: '換罐雞肉',
  unit: '罐',
  status: 'active',
  productCategory: 'JAR_EXCHANGE',
};
const jarInactive: ProductRow = {
  id: 'jar-off',
  name: '停用換罐',
  unit: '罐',
  status: 'inactive',
  productCategory: 'JAR_EXCHANGE',
};
const serviceProduct: ProductRow = {
  id: 'svc-1',
  name: '美容',
  unit: '次',
  status: 'active',
  productCategory: 'SERVICE',
};

async function submit(
  db: SubmitSelfSelectDb,
  merchantId: string,
  productIds: string[],
) {
  return submitSelfSelectRestockRequest(
    {
      merchantId,
      merchantUserId: 'user-a',
      items: productIds.map((productId) => ({ productId, quantity: 2 })),
    },
    db,
  );
}

describe('merchant restock catalog eligibility', () => {
  it('allows active STANDARD only when this store has stock or a rule', () => {
    const inStore = buildMerchantRestockInStoreIds(
      [{ productId: 'std-a' }],
      [],
    );
    assert.equal(isMerchantRestockCatalogEligible(standardInA, inStore), true);
    assert.equal(isMerchantRestockCatalogEligible(standardInA, new Set()), false);
  });

  it('allows active JAR_EXCHANGE without store stock', () => {
    assert.equal(isMerchantRestockCatalogEligible(jarActive, new Set()), true);
    assert.equal(isMerchantRestockCatalogEligible(jarInactive, new Set()), false);
  });

  it('rejects unsupported types and missing products for the whole ticket', () => {
    const products = [standardInA, jarActive];
    const inStore = new Set(['std-a']);
    assert.deepEqual(
      merchantRestockSubmitEligibility(['std-a', 'jar-1'], products, inStore),
      { ok: true },
    );
    assert.deepEqual(
      merchantRestockSubmitEligibility(['missing'], products, inStore),
      { ok: false, reason: 'missing' },
    );
    assert.deepEqual(
      merchantRestockSubmitEligibility(['svc-1'], [serviceProduct], inStore),
      { ok: false, reason: 'ineligible' },
    );
    assert.deepEqual(
      merchantRestockSubmitEligibility(['std-a', 'svc-1'], [...products, serviceProduct], inStore),
      { ok: false, reason: 'ineligible' },
    );
  });
});

describe('submitSelfSelectRestockRequest catalog eligibility', () => {
  it('submits an eligible STANDARD product', async () => {
    const db = createMemorySubmitDb({
      products: [standardInA],
      stocks: [{ merchantId: STORE_A, productId: 'std-a', quantity: 0 }],
    });
    await submit(db, STORE_A, ['std-a']);
    assert.equal(db.state.creates, 1);
  });

  it('submits an eligible STANDARD with only this store rule', async () => {
    const db = createMemorySubmitDb({
      products: [standardInA],
      rules: [{ merchantId: STORE_A, productId: 'std-a' }],
    });
    await submit(db, STORE_A, ['std-a']);
    assert.equal(db.state.creates, 1);
  });

  it('submits an eligible JAR_EXCHANGE product', async () => {
    const db = createMemorySubmitDb({ products: [jarActive] });
    await submit(db, STORE_A, ['jar-1']);
    assert.equal(db.state.creates, 1);
  });

  it('rejects STANDARD that only another store stocks or consigns', async () => {
    const db = createMemorySubmitDb({
      products: [standardInA],
      stocks: [{ merchantId: STORE_B, productId: 'std-a', quantity: 8 }],
      rules: [{ merchantId: STORE_B, productId: 'std-a' }],
    });
    await assert.rejects(
      () => submit(db, STORE_A, ['std-a']),
      /這項商品目前不能補貨/,
    );
    assert.equal(db.state.creates, 0);
  });

  it('rejects inactive, unknown, and unsupported products', async () => {
    const db = createMemorySubmitDb({
      products: [jarInactive, serviceProduct],
    });
    await assert.rejects(() => submit(db, STORE_A, ['jar-off']), /這項商品目前不能補貨/);
    await assert.rejects(() => submit(db, STORE_A, ['missing']), /有商品不存在/);
    await assert.rejects(() => submit(db, STORE_A, ['svc-1']), /這項商品目前不能補貨/);
    assert.equal(db.state.creates, 0);
  });

  it('rejects a mixed legal and illegal ticket without writing', async () => {
    const db = createMemorySubmitDb({
      products: [jarActive, standardInA],
      stocks: [{ merchantId: STORE_B, productId: 'std-a', quantity: 1 }],
    });
    await assert.rejects(
      () => submit(db, STORE_A, ['jar-1', 'std-a']),
      /這項商品目前不能補貨/,
    );
    assert.equal(db.state.creates, 0);
  });

  it('uses the server merchantId for stock and rule scope', async () => {
    const db = createMemorySubmitDb({
      products: [standardInA],
      stocks: [{ merchantId: STORE_A, productId: 'std-a', quantity: 1 }],
    });
    const sessionMerchantId = resolveMerchantIdForQuery(STORE_B, STORE_A);
    assert.equal(sessionMerchantId, STORE_B);
    await assert.rejects(
      () => submit(db, sessionMerchantId, ['std-a']),
      /這項商品目前不能補貨/,
    );
    assert.equal(db.state.creates, 0);
  });

  it('rejects at submit even if the product was on the catalog earlier', async () => {
    const db = createMemorySubmitDb({
      products: [standardInA],
      stocks: [{ merchantId: STORE_A, productId: 'std-a', quantity: 1 }],
    });
    const listed = await listMerchantRestockCatalog(STORE_A, db);
    assert.deepEqual(
      listed.map((row) => row.id),
      ['std-a'],
    );
    db.state.stocks = [];
    await assert.rejects(() => submit(db, STORE_A, ['std-a']), /這項商品目前不能補貨/);
    assert.equal(db.state.creates, 0);
  });
});

describe('POS restock submit entries', () => {
  it('inventory cart and restock page both use the same session-scoped submit', () => {
    const restock = readFileSync(`${process.cwd()}/app/pos/restock/actions.ts`, 'utf8');
    const stock = readFileSync(`${process.cwd()}/app/pos/stock/actions.ts`, 'utf8');
    for (const source of [restock, stock]) {
      assert.match(source, /submitSelfSelectRestockRequest/);
      assert.match(source, /getAuthenticatedMerchantId\(\)/);
      assert.equal(source.includes("formData.get('merchantId')"), false);
      assert.equal(source.includes('formData.get("merchantId")'), false);
    }
  });
});
