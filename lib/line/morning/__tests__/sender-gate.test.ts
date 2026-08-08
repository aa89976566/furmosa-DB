import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  assertMorningSenderUnused,
  createMorningDryRunSender,
  getMorningOutboundSender,
} from '../sender-gate';

describe('morning sender gate', () => {
  it('dry-run sender 呼叫記數且 skipped；assert 要求 0', async () => {
    const s = createMorningDryRunSender();
    assert.equal(s.getCallCount(), 0);
    assertMorningSenderUnused(s);
    const r = await s.push('U_TEST_x', [{ type: 'text', text: 'hi' }]);
    assert.equal(r.skipped, true);
    assert.equal(s.getCallCount(), 1);
    assert.throws(() => assertMorningSenderUnused(s));
    s.resetCallCount();
    assertMorningSenderUnused(s);
  });

  it('getMorningOutboundSender 在 Preview 旗標下永不暴露真送', async () => {
    const s = getMorningOutboundSender({ forceDryRun: true });
    s.resetCallCount();
    await s.push('U1', [{ type: 'text', text: 'x' }]);
    // 即使呼叫也被 blocked；正式 runner 路徑不得呼叫
    assert.ok(s.getCallCount() >= 1);
    const again = getMorningOutboundSender();
    again.resetCallCount();
    assert.equal(again.getCallCount(), 0);
  });
});
