import { test } from 'node:test';
import assert from 'node:assert/strict';
import { understand } from '../openai.ts';
import { emptyProfile } from '../conversation.ts';
const config = { apiKey: 'test-fixture', model: 'test-model' };
const history = [{ role: 'user' as const, content: '兔兔想找磨牙玩具' }];
const data = { profile: { ...emptyProfile(), species: 'rabbit', need: 'chewing', category: 'toy' }, clearAvoid: false, clearRequirements: false, medical: false, shopping: true };
test('模型請求使用結構化回應且不儲存對話', async () => {
  const request: typeof fetch = async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.type, 'json_schema');
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(data) }] }] });
  };
  assert.deepEqual(await understand(emptyProfile(), history, config, request), data);
});
test('未設金鑰時不發出 API 請求', async () => {
  await assert.rejects(understand(emptyProfile(), history, { ...config, apiKey: '' }, async () => { throw new Error('MUST_NOT_CALL'); }), /GUIDE_NOT_CONFIGURED/);
});
test('上游失敗不外洩錯誤回應與憑證', async () => {
  await assert.rejects(understand(emptyProfile(), history, config, async () => new Response('private upstream text', { status: 401 })), /^Error: GUIDE_PROVIDER_UNAVAILABLE$/);
});
test('模型拒答或未完成不能當作正常導購', async () => {
  await assert.rejects(understand(emptyProfile(), history, config, async () => Response.json({ status: 'incomplete' })), /GUIDE_INCOMPLETE/);
  await assert.rejects(understand(emptyProfile(), history, config, async () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] })), /GUIDE_REFUSED/);
});
