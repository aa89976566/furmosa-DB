import { test } from 'node:test';
import assert from 'node:assert/strict';
import { issueWishToken, verifyWishToken, parseWish, submitWish, readWish, canReviewWishes, wishStatus, assertRegularTask } from '../wishes.ts';
import type { WishStore, WishTask } from '../wishes.ts';

const secret = 'fixture-secret-for-tests-only-32-characters';
const time = 1794140000000;
const input = { species: '兔兔', requestText: '想找安全的磨牙玩具', lineId: 'test_rabbit' };
const token = issueWishToken(secret, time, 'test-nonce-0123456789');
const config = { enabled: true, secret, now: time + 2000 };
function memoryStore() {
  const rows: Array<WishTask & { reference: string; createdAt: Date; type: string }> = [];
  let queue = Promise.resolve();
  const store: WishStore = { transaction: async run => {
    const before = queue; let release!: () => void;
    queue = new Promise<void>(resolve => { release = resolve; });
    await before;
    try { return await run({
      lock: async () => {},
      find: async id => rows.find(r => r.taskId === id) ?? null,
      count: async (since, reference) => rows.filter(r => r.createdAt >= since && (!reference || r.reference === reference)).length,
      create: async data => { const row = { ...data, id: `fixture-${rows.length}`, createdAt: new Date(config.now) }; rows.push(row); return row; },
    }); } finally { release(); }
  } };
  return { store, rows };
}
test('許願保存物種、需求與 LINE，預設待審核', async () => {
  const { store, rows } = memoryStore();
  const result = await submitWish(input, token, '192.0.2.1', config, store);
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'todo');
  assert.equal(rows[0].type, 'customer_service'); assert.equal(result.duplicate, false);
  const record = readWish(rows[0].description)!;
  assert.equal(record.species, '兔兔'); assert.equal(record.lineId, input.lineId);
  assert.equal(record.requestText, input.requestText);
  assert.ok(!JSON.stringify(rows).includes('192.0.2.1'));
});
test('並行雙擊只建立一筆，重送不覆蓋已審核狀態', async () => {
  const { store, rows } = memoryStore();
  await Promise.all([submitWish(input, token, '192.0.2.1', config, store), submitWish(input, token, '192.0.2.1', config, store)]);
  assert.equal(rows.length, 1); rows[0].status = 'done';
  await submitWish(input, token, '192.0.2.1', config, store);
  assert.equal(rows[0].status, 'done');
});
test('同 token 偷換需求不覆蓋原許願', async () => {
  const { store, rows } = memoryStore();
  await submitWish(input, token, '192.0.2.1', config, store);
  await assert.rejects(submitWish({ ...input, lineId: 'other_id' }, token, '192.0.2.1', config, store), /REPLAY_CONFLICT/);
  assert.equal(readWish(rows[0].description)?.lineId, input.lineId);
});
test('偽造、逾時與過快 token 被拒絕', () => {
  assert.throws(() => verifyWishToken(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'), secret, time + 2000), /INVALID_TOKEN/);
  assert.throws(() => verifyWishToken(token, secret, time + 31 * 60 * 1000), /EXPIRED_TOKEN/);
  assert.throws(() => verifyWishToken(token, secret, time), /EXPIRED_TOKEN/);
});
test('每 IP 24小時最多五筆，其他來源仍可提交', async () => {
  const { store, rows } = memoryStore();
  for (let n = 0; n < 5; n++) await submitWish(input, issueWishToken(secret, time, `test-nonce-01234567-${n}`), '192.0.2.1', config, store);
  await assert.rejects(submitWish(input, token, '192.0.2.1', config, store), /RATE_LIMITED/);
  await submitWish(input, token, '192.0.2.2', config, store); assert.equal(rows.length, 6);
});
test('關閉或未設定、無來源時不得寫資料', async () => {
  const { store, rows } = memoryStore();
  await assert.rejects(submitWish(input, token, '192.0.2.1', { ...config, enabled: false }, store), /DISABLED/);
  await assert.rejects(submitWish(input, token, '192.0.2.1', { ...config, secret: '' }, store), /NOT_CONFIGURED/);
  await assert.rejects(submitWish(input, token, '', config, store), /MISSING_CLIENT/);
  assert.equal(rows.length, 0);
});
test('拒絕空需求、超長欄位與顯示名稱冒充 LINE ID', () => {
  for (const patch of [{ requestText: '' }, { species: '兔'.repeat(41) }, { lineId: '小兔媽媽' }, { lineId: 'abc\n123' }]) assert.throws(() => parseWish({ ...input, ...patch }));
});
test('多行需求可以完整保存', () => {
  assert.equal(parseWish({ ...input, requestText: '想找磨牙玩具\n目前會咬籠子' }).requestText, '想找磨牙玩具\n目前會咬籠子');
});
test('資料庫失敗不能回報成功', async () => {
  const store: WishStore = { transaction: async () => { throw new Error('fixture storage unavailable'); } };
  await assert.rejects(submitWish(input, token, '192.0.2.1', config, store), /storage unavailable/);
});
test('全站24小時100筆上限跨來源生效', async () => {
  const { store, rows } = memoryStore();
  for (let n = 0; n < 100; n++) await submitWish(input, issueWishToken(secret, time, `test-global-nonce-${n}`), `client-${n}`, config, store);
  await assert.rejects(submitWish(input, token, 'new-client', config, store), /RATE_LIMITED/);
  assert.equal(rows.length, 100);
});
test('非客服角色不能審核、狀態限制在既有任務狀態', () => {
  assert.equal(canReviewWishes(undefined), false); assert.equal(canReviewWishes('warehouse'), false);
  assert.equal(canReviewWishes('admin'), true); assert.equal(canReviewWishes('staff'), true);
  assert.equal(wishStatus('in_progress'), 'in_progress'); assert.throws(() => wishStatus('approved'));
});
test('共用任務入口阻擋許願資料，舊任務仍可操作', () => {
  assert.throws(() => assertRegularTask({ reference: 'FMWISH:fixture' }), /許願池審核頁/);
  assert.doesNotThrow(() => assertRegularTask({ reference: null }));
  assert.doesNotThrow(() => assertRegularTask({ reference: 'ORD-1234' }));
});
