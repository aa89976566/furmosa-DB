import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addRestockLine,
  addSelectedToCart,
  completeDemoSale,
  createSession,
  selectVariant,
  submitRestockDraft,
} from '../session';

function withFetchProbe(run: () => void) {
  const key = 'fetch';
  const original = (globalThis as { fetch?: unknown })[key];
  let calls = 0;
  (globalThis as { fetch?: unknown })[key] = () => {
    calls += 1;
    return Promise.resolve({ ok: true });
  };
  try {
    run();
  } finally {
    (globalThis as { fetch?: unknown })[key] = original;
  }
  return calls;
}

describe('merchant POS preview never calls remote write', () => {
  it('completes a demo sale without any remote call', () => {
    const calls = withFetchProbe(() => {
      let session = createSession();
      session = selectVariant(session, 'prod-beef', 'sku-beef-80');
      session = addSelectedToCart(session, 'prod-beef');
      session = completeDemoSale(session);
      assert.equal(session.demoReceipts.length, 1);
      assert.match(session.demoReceipts[0]?.notice ?? '', /並未建立真實訂單/);
    });
    assert.equal(calls, 0);
  });

  it('submits restock without any remote call', () => {
    const calls = withFetchProbe(() => {
      let session = createSession();
      session = addRestockLine(session, 'sku-slmn-1');
      session = submitRestockDraft(session);
      assert.equal(session.restockSubmitted, true);
    });
    assert.equal(calls, 0);
  });
});
