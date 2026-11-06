import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requestShipmentQueueStatus } from '../shipment-queue-request';

function input() {
  const form = new FormData();
  form.set('shipmentId', 'shipment-1');
  form.set('next', 'shipped');
  return form;
}
const reply = (body: unknown, status = 200) => Response.json(body, { status });

test('saved dispatch uses JSON without an RSC transition', async () => {
  const methods: string[] = [];
  const result = await requestShipmentQueueStatus(input(), async (_url, options) => {
    methods.push(options!.method!);
    assert.equal(options!.credentials, 'same-origin');
    return reply({ ok: true, shipmentId: 'shipment-1', next: 'shipped' });
  });
  assert.deepEqual(result, { ok: true, shipmentId: 'shipment-1', next: 'shipped' });
  assert.deepEqual(methods, ['POST']);
});

test('OMS gate rejection reaches the UI without retry or hiding the row', async () => {
  let calls = 0;
  const result = await requestShipmentQueueStatus(input(), async () => {
    calls += 1;
    return reply({ ok: false, error: '請先完成審核' }, 409);
  });
  assert.deepEqual(result, { ok: false, error: '請先完成審核' });
  assert.equal(calls, 1);
});

test('a stalled POST is bounded and reconciles with GET, never a second POST', async () => {
  const methods: string[] = [];
  const result = await requestShipmentQueueStatus(input(), async (_url, options) => {
    methods.push(options!.method!);
    if (options!.method === 'POST') return new Promise<Response>(() => {});
    return reply({ ok: true, shipmentId: 'shipment-1', status: 'shipped' });
  }, 10);
  assert.deepEqual(result, { ok: true, shipmentId: 'shipment-1', next: 'shipped' });
  assert.deepEqual(methods, ['POST', 'GET']);
});

test('both requests stalled exits processing as uncertain, without false success', async () => {
  const methods: string[] = [];
  const startedAt = Date.now();
  const result = await requestShipmentQueueStatus(input(), async (_url, options) => {
    methods.push(options!.method!);
    return new Promise<Response>(() => {});
  }, 10);
  assert.equal(result.ok, false);
  assert.ok(!result.ok && result.uncertain);
  assert.deepEqual(methods, ['POST', 'GET']);
  assert.ok(Date.now() - startedAt < 500);
});

test('a lost response with unchanged durable status does not claim success', async () => {
  const result = await requestShipmentQueueStatus(input(), async (_url, options) => {
    if (options!.method === 'POST') throw new Error('CONNECTION_RESET');
    return reply({ ok: true, shipmentId: 'shipment-1', status: 'pending' });
  });
  assert.ok(!result.ok && result.uncertain);
});
