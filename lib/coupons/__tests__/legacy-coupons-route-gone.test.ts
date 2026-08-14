import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { POST } from '../../../app/api/coupons/route.ts';

const EXPECTED_STATUS = 410;
const EXPECTED_JSON = { error: '此兌換入口已停用' };
const EXPECTED_BODY = JSON.stringify(EXPECTED_JSON);

/** 真實 POST 不讀入參；測試仍傳入以證明 body／headers 不可達。 */
const callPost = POST as (input?: unknown) => Promise<Response>;

const bodyTouches = {
  json: 0,
  text: 0,
  formData: 0,
  arrayBuffer: 0,
  blob: 0,
  clone: 0,
};

function trap(name: keyof typeof bodyTouches) {
  return () => {
    bodyTouches[name] += 1;
    throw new Error(`request.${name} must not be read`);
  };
}

function trappedRequest(): Request {
  return {
    json: trap('json'),
    text: trap('text'),
    formData: trap('formData'),
    arrayBuffer: trap('arrayBuffer'),
    blob: trap('blob'),
    clone: trap('clone'),
  } as unknown as Request;
}

function postRequest(body?: string, contentType = 'application/json'): Request {
  return new Request('http://furmosa.test/api/coupons', {
    method: 'POST',
    headers: contentType ? { 'content-type': contentType } : undefined,
    body,
  });
}

async function assertFixedGone(res: Response, forbidden: string[]) {
  assert.equal(res.status, EXPECTED_STATUS);

  const contentType = res.headers.get('content-type') ?? '';
  assert.match(contentType, /application\/json/i);

  const cacheControl = res.headers.get('cache-control') ?? '';
  assert.match(cacheControl, /no-store/i);
  assert.match(cacheControl, /max-age=0/i);

  assert.equal(res.headers.get('location'), null);
  assert.equal(res.headers.get('set-cookie'), null);

  const text = await res.text();
  assert.equal(text, EXPECTED_BODY);
  assert.deepEqual(JSON.parse(text), EXPECTED_JSON);

  const headerBlob = [...res.headers.entries()].flat().join('\n');
  const haystack = `${text}\n${headerBlob}`;
  for (const marker of forbidden) {
    assert.equal(haystack.includes(marker), false, `response leaked marker: ${marker}`);
  }
  assert.doesNotMatch(text, /at POST|TypeError|stack/i);
}

describe('legacy POST /api/coupons is permanently gone', () => {
  it('returns 410 for valid JSON without reading the body', async () => {
    const payload = {
      action: 'redeem',
      couponCode: 'FURMOSA-1234',
      storeId: 'zhuwo_zhonghe',
      redeemedBy: '小美',
      customer: '王小明',
      name: '王小明',
      phone: '0912345678',
      LINE: 'Uleaklineid001',
    };
    const res = await callPost(postRequest(JSON.stringify(payload)));
    await assertFixedGone(res, [
      'FURMOSA-1234',
      'zhuwo_zhonghe',
      '小美',
      '王小明',
      '0912345678',
      'Uleaklineid001',
      'redeemedBy',
      'storeId',
      'couponCode',
      'customer',
    ]);
  });

  it('returns the same 410 for malformed JSON', async () => {
    const raw = '{"couponCode":"FURMOSA-7777",storeId:';
    const res = await callPost(postRequest(raw));
    await assertFixedGone(res, ['FURMOSA-7777', 'storeId', 'couponCode']);
  });

  it('returns the same 410 for SQL/JSON injection-like payload', async () => {
    const raw =
      '{"couponCode":"FURMOSA-0001\'; DROP TABLE coupons;--","storeId":"zhuwo_zhonghe","__proto__":{"admin":true},"redeemedBy":"evil"}';
    const res = await callPost(postRequest(raw));
    await assertFixedGone(res, [
      'FURMOSA-0001',
      'DROP TABLE',
      'zhuwo_zhonghe',
      'redeemedBy',
      'storeId',
      'couponCode',
      '__proto__',
    ]);
  });

  it('returns the same 410 for empty body', async () => {
    const res = await callPost(postRequest());
    await assertFixedGone(res, ['couponCode', 'storeId', 'redeemedBy', 'customer']);
  });

  it('does not touch request body helpers on a trap double', async () => {
    const res = await callPost(trappedRequest());
    await assertFixedGone(res, ['must not be read', 'request.json', 'couponCode', 'storeId']);
    assert.deepEqual(bodyTouches, {
      json: 0,
      text: 0,
      formData: 0,
      arrayBuffer: 0,
      blob: 0,
      clone: 0,
    });
  });

  it('body traps stay unreachable after all cases', async () => {
    const res = await callPost(trappedRequest());
    await assertFixedGone(res, ['must not be read', 'request.json', 'couponCode', 'storeId']);
    assert.deepEqual(bodyTouches, {
      json: 0,
      text: 0,
      formData: 0,
      arrayBuffer: 0,
      blob: 0,
      clone: 0,
    });
  });
});
