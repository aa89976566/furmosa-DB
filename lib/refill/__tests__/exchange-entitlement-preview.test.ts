import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REFILL_EXCHANGE_PREVIEW_FIXTURE,
  REFILL_EXCHANGE_PREVIEW_STATES,
  buildActivatedPreviewMessages,
  buildJoinBeforePreviewMessages,
  buildRefillExchangePreviewMessages,
  getRefillExchangePreviewMeta,
} from '../exchange-entitlement-preview';
import { REFILL_EXCHANGE_WINDOW_COPY } from '../exchange-window';

describe('refill exchange entitlement HQ preview', () => {
  it('covers all five acceptance states with precise paths', () => {
    assert.deepEqual([...REFILL_EXCHANGE_PREVIEW_STATES], [
      'join-before',
      'activated',
      'wrong-store',
      'expiring-soon',
      'expired',
    ]);
    for (const state of REFILL_EXCHANGE_PREVIEW_STATES) {
      const meta = getRefillExchangePreviewMeta(state);
      assert.equal(meta.mode, 'preview-only');
      assert.equal(meta.liveEnforcement, false);
      assert.equal(meta.sendsLine, false);
      assert.equal(meta.readsDb, false);
      assert.equal(
        meta.path,
        `/admin/line-message-preview/refill-exchange-window?state=${state}`,
      );
      const msgs = buildRefillExchangePreviewMessages(state);
      assert.ok(msgs.length >= 1);
      assert.equal(msgs[0]?.type, 'flex');
      assert.doesNotThrow(() => JSON.stringify(msgs));
    }
  });

  it('join-before Flex keeps 30-day emphasis contract', () => {
    const raw = JSON.stringify(buildJoinBeforePreviewMessages());
    assert.match(raw, /空瓶交回原店後，記得在/);
    assert.match(raw, /"text":"30 天內"/);
    assert.match(raw, /"size":"xl"/);
    assert.match(raw, /"weight":"bold"/);
    assert.match(raw, /"wrap":true/);
    assert.match(raw, new RegExp(REFILL_EXCHANGE_WINDOW_COPY.previewBadge));
    assert.match(raw, /我要參加/);
    assert.match(raw, /查看完整規則/);
    assert.match(raw, /這罐吃完，先別急著說再見/);
    assert.doesNotMatch(raw, /怎麼參加/);
    assert.doesNotMatch(raw, /蔬果凍乾/);
  });

  it('activated Flex emphasizes window and long store name wraps', () => {
    const msgs = buildActivatedPreviewMessages({
      storeName: REFILL_EXCHANGE_PREVIEW_FIXTURE.storeName,
    });
    const raw = JSON.stringify(msgs);
    assert.match(raw, /空瓶平安回店/);
    assert.match(raw, /"text":"30 天內"/);
    assert.match(raw, /"size":"xl"/);
    assert.match(raw, /"weight":"bold"/);
    assert.match(raw, /最晚使用日：\d{4}\/\d{2}\/\d{2}/);
    assert.match(raw, new RegExp(REFILL_EXCHANGE_PREVIEW_FIXTURE.storeName));
    assert.match(raw, /Preview/);
  });
});
