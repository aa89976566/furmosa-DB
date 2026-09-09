import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Module, { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { before, describe, it } from 'node:test';

type RequestRow = {
  id: string;
  merchantId: string;
  status: string;
  shipmentId: string | null;
  hqNote: string | null;
  rejectedAt: Date | null;
  approvedByUserId: string | null;
};

type World = {
  request: RequestRow;
  updates: Array<Record<string, unknown>>;
};

function baseRequest(overrides: Partial<RequestRow> = {}): RequestRow {
  return {
    id: 'request-1',
    merchantId: 'merchant-1',
    status: 'submitted',
    shipmentId: null,
    hqNote: null,
    rejectedAt: null,
    approvedByUserId: null,
    ...overrides,
  };
}

let world: World = { request: baseRequest(), updates: [] };

const harness = globalThis as typeof globalThis & {
  __TEST_PRISMA__: {
    restockRequest: {
      findUnique: (args: { where: { id: string } }) => Promise<RequestRow | null>;
      update: (args: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => Promise<RequestRow>;
    };
  };
};

harness.__TEST_PRISMA__ = {
  restockRequest: {
    findUnique: async ({ where }) =>
      world.request.id === where.id ? { ...world.request } : null,
    update: async ({ where, data }) => {
      assert.equal(where.id, world.request.id);
      world.updates.push({ ...data });
      Object.assign(world.request, data);
      return { ...world.request };
    },
  },
};

const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@/lib/prisma') return mockPrisma();
  const resolved = await nextResolve(specifier, context);
  const url = String(resolved.url || '');
  if (url.includes('/lib/prisma.') || url.endsWith('/lib/prisma')) return mockPrisma();
  return resolved;
}
function mockPrisma() {
  return {
    shortCircuit: true,
    url: 'data:text/javascript,export const prisma = globalThis.__TEST_PRISMA__;',
  };
}
`;

register(`data:text/javascript,${encodeURIComponent(loader)}`, pathToFileURL(import.meta.url));

type NodeModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;
const moduleApi = Module as unknown as { _load: NodeModuleLoad };
const originalLoad = moduleApi._load;

function isPrismaRequest(request: string) {
  return (
    request === '@/lib/prisma' ||
    request.endsWith('/lib/prisma') ||
    request.endsWith('/lib/prisma.ts') ||
    request.includes('/lib/prisma.')
  );
}

let rejectRestockRequest: (typeof import('@/lib/restock-request/service'))['rejectRestockRequest'];

describe('rejectRestockRequest 拒絕原因驗證', () => {
  before(async () => {
    moduleApi._load = function patchedLoad(request, parent, isMain) {
      if (isPrismaRequest(String(request))) {
        return { prisma: harness.__TEST_PRISMA__ };
      }
      return originalLoad.call(this, request, parent, isMain);
    };
    try {
      ({ rejectRestockRequest } = await import('@/lib/restock-request/service'));
    } finally {
      moduleApi._load = originalLoad;
    }
  });

  it('空白拒絕原因被伺服器擋下並回傳明確錯誤', async () => {
    world = { request: baseRequest(), updates: [] };
    await assert.rejects(
      () =>
        rejectRestockRequest({
          requestId: 'request-1',
          hqUserId: 'hq-1',
          hqNote: '',
        }),
      /請填寫拒絕原因/,
    );
    assert.equal(world.updates.length, 0);
    assert.equal(world.request.status, 'submitted');
  });

  it('全空白拒絕原因被伺服器擋下並回傳明確錯誤', async () => {
    world = { request: baseRequest({ hqNote: '先前備註' }), updates: [] };
    await assert.rejects(
      () =>
        rejectRestockRequest({
          requestId: 'request-1',
          hqUserId: 'hq-1',
          hqNote: '   \n\t  ',
        }),
      /請填寫拒絕原因/,
    );
    assert.equal(world.updates.length, 0);
    assert.equal(world.request.status, 'submitted');
    assert.equal(world.request.hqNote, '先前備註');
  });

  it('有原因時拒絕正常成功', async () => {
    world = { request: baseRequest(), updates: [] };
    const result = await rejectRestockRequest({
      requestId: 'request-1',
      hqUserId: 'hq-1',
      hqNote: '  庫存足夠，本次不補  ',
    });
    assert.equal(result.status, 'rejected');
    assert.equal(result.hqNote, '庫存足夠，本次不補');
    assert.equal(result.approvedByUserId, 'hq-1');
    assert.equal(world.updates.length, 1);
    assert.equal(world.updates[0]?.status, 'rejected');
    assert.equal(world.updates[0]?.hqNote, '庫存足夠，本次不補');
  });

  it('HQ 拒絕表單有必填提示，action 會把服務錯誤傳回畫面', () => {
    const form = readFileSync(
      new URL('../../../app/(main)/restock-requests/[id]/hq-restock-form.tsx', import.meta.url),
      'utf8',
    );
    assert.match(form, />\s*拒絕時必須在『公司備註』填寫原因\s*</);
    assert.match(form, /rejectRestockRequestAction/);

    const actions = readFileSync(
      new URL('../../../app/(main)/restock-requests/actions.ts', import.meta.url),
      'utf8',
    );
    assert.match(actions, /rejectRestockRequest\(/);
    assert.match(actions, /error: e instanceof Error \? e\.message : '拒絕失敗'/);
  });
});
