/**
 * Legacy POST /api/coupons — 410 Gone 止血鎖。
 * 直接 import 實際 handler；零 DB／零 service side effect。
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { POST } from '@/app/api/coupons/route';

const EXPECTED_BODY = { ok: false, error: '此核銷入口已停用' } as const;

function createBodyTrapRequest() {
  let bodyReads = 0;
  let jsonReads = 0;
  let textReads = 0;
  let formDataReads = 0;

  const req = {
    get body() {
      bodyReads += 1;
      throw new Error('body getter must not be read');
    },
    async json() {
      jsonReads += 1;
      throw new Error('json() must not be called');
    },
    async text() {
      textReads += 1;
      throw new Error('text() must not be called');
    },
    async formData() {
      formDataReads += 1;
      throw new Error('formData() must not be called');
    },
  };

  return {
    req,
    counts: () => ({ bodyReads, jsonReads, textReads, formDataReads }),
  };
}

async function assertGone(res: Response) {
  assert.equal(res.status, 410);
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  const json = await res.json();
  assert.deepEqual(json, EXPECTED_BODY);
  assert.equal(json.ok, false);
  assert.equal('coupon' in json, false);
  assert.equal('customerName' in json, false);
  assert.equal('storeId' in json, false);
}

describe('legacy POST /api/coupons — 410 Gone', () => {
  it('handler takes no Request parameter', () => {
    assert.equal(POST.length, 0);
  });

  it('合法 verify JSON → 410 且回應一致', async () => {
    const { req, counts } = createBodyTrapRequest();
    const res = await POST(req as never);
    await assertGone(res);
    assert.deepEqual(counts(), {
      bodyReads: 0,
      jsonReads: 0,
      textReads: 0,
      formDataReads: 0,
    });
  });

  it('合法 redeem JSON → 410 且回應一致', async () => {
    const { req, counts } = createBodyTrapRequest();
    const res = await POST(req as never);
    await assertGone(res);
    assert.deepEqual(counts(), {
      bodyReads: 0,
      jsonReads: 0,
      textReads: 0,
      formDataReads: 0,
    });
  });

  it('malformed / 攻擊字串 / 偽造 storeId／redeemedBy → 仍 410 且 body 未讀', async () => {
    const payloads = [
      'not-json',
      '{"couponCode":"FURMOSA-0001","storeId":"niuniu","action":"verify"}',
      '{"couponCode":"FURMOSA-0001","storeId":"niuniu","action":"redeem","redeemedBy":"attacker"}',
      '{"storeId":"../../etc/passwd","couponCode":"<script>","redeemedBy":{"$gt":""}}',
      '',
    ];

    for (const _label of payloads) {
      const { req, counts } = createBodyTrapRequest();
      const res = await POST(req as never);
      await assertGone(res);
      assert.deepEqual(counts(), {
        bodyReads: 0,
        jsonReads: 0,
        textReads: 0,
        formDataReads: 0,
      });
    }
  });

  it('無引數呼叫仍 410', async () => {
    const res = await POST();
    await assertGone(res);
  });

  it('route 靜態鎖定：無 service import／verify／redeem／req.json', () => {
    const src = readFileSync(join(process.cwd(), 'app/api/coupons/route.ts'), 'utf8');
    assert.equal(src.includes('@/lib/coupons/service'), false);
    assert.equal(src.includes('verifyCouponAtStore'), false);
    assert.equal(src.includes('confirmCouponRedemptionAtStore'), false);
    assert.equal(src.includes('req.json'), false);
    assert.equal(src.includes('request.json'), false);
    assert.equal(src.includes('partner-stores'), false);
    assert.match(src, /status:\s*410/);
    assert.match(src, /Cache-Control/);
  });
});
