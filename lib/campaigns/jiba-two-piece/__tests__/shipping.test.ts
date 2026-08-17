import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FLOW_STATE } from '../constants';
import {
  JIBA_COLLECTING_SEQUENCE,
  isJibaShippingComplete,
  isJibaUpsellBeforeShipping,
  jibaSequenceIndex,
  nextJibaShippingState,
  resolveJibaResumeState,
  shippingSnapshotFrom,
} from '../shipping';

describe('jiba shipping completeness', () => {
  it('requires name, phone and store', () => {
    assert.equal(isJibaShippingComplete({}), false);
    assert.equal(
      isJibaShippingComplete({ recipientName: '王小明', recipientPhone: '0912345678' }),
      false,
    );
    assert.equal(
      isJibaShippingComplete({
        recipientName: '王小明',
        recipientPhone: '0912345678',
        storeName: '板橋新埔門市',
      }),
      true,
    );
  });

  it('returns the first missing shipping state', () => {
    assert.equal(nextJibaShippingState({}), FLOW_STATE.ASK_RECIPIENT_NAME);
    assert.equal(
      nextJibaShippingState({ recipientName: '王小明' }),
      FLOW_STATE.ASK_RECIPIENT_PHONE,
    );
    assert.equal(
      nextJibaShippingState({ recipientName: '王小明', recipientPhone: '0912345678' }),
      FLOW_STATE.ASK_STORE,
    );
    assert.equal(
      nextJibaShippingState({
        recipientName: '王小明',
        recipientPhone: '0912345678',
        storeName: '板橋新埔門市',
      }),
      null,
    );
  });

  it('reads shipping from application or collected JSON', () => {
    const snap = shippingSnapshotFrom(
      { recipientName: '王小明' },
      { recipientPhone: '0912345678', storeName: '淡水老街門市' },
    );
    assert.equal(snap.recipientName, '王小明');
    assert.equal(snap.recipientPhone, '0912345678');
    assert.equal(snap.storeName, '淡水老街門市');
    assert.equal(isJibaShippingComplete(snap), true);
  });
});

describe('old upsell session guard', () => {
  it('keeps non-upsell states in place', () => {
    assert.equal(
      resolveJibaResumeState(FLOW_STATE.ASK_RECIPIENT_NAME, {}),
      FLOW_STATE.ASK_RECIPIENT_NAME,
    );
    assert.equal(
      resolveJibaResumeState(FLOW_STATE.SHOW_BRIEF, {}),
      FLOW_STATE.SHOW_BRIEF,
    );
    assert.equal(
      resolveJibaResumeState(
        FLOW_STATE.ASK_INSTAGRAM,
        {
          recipientName: '王小明',
          recipientPhone: '0912345678',
          storeName: '板橋新埔門市',
        },
        { upsellAsked: false },
      ),
      FLOW_STATE.ASK_INSTAGRAM,
    );
  });

  it('redirects ASK_UPSELL without shipping back to the missing field', () => {
    assert.equal(resolveJibaResumeState(FLOW_STATE.ASK_UPSELL, {}), FLOW_STATE.ASK_RECIPIENT_NAME);
    assert.equal(
      resolveJibaResumeState(FLOW_STATE.ASK_UPSELL, { recipientName: '王小明' }),
      FLOW_STATE.ASK_RECIPIENT_PHONE,
    );
    assert.equal(
      resolveJibaResumeState(FLOW_STATE.ASK_UPSELL, {
        recipientName: '王小明',
        recipientPhone: '0912345678',
      }),
      FLOW_STATE.ASK_STORE,
    );
    assert.equal(
      resolveJibaResumeState(FLOW_STATE.ASK_UPSELL, {
        recipientName: '王小明',
        recipientPhone: '0912345678',
        storeName: '板橋新埔門市',
      }),
      FLOW_STATE.ASK_UPSELL,
    );
  });

  it('redirects post-upsell collecting sessions to transfer when fee is due', () => {
    const snap = {
      recipientName: '王小明',
      recipientPhone: '0912345678',
      storeName: '板橋新埔門市',
    };
    assert.equal(
      resolveJibaResumeState(FLOW_STATE.ASK_INSTAGRAM, snap, { upsellAsked: true }, 'unpaid'),
      FLOW_STATE.ASK_TRANSFER,
    );
    assert.equal(
      resolveJibaResumeState(
        FLOW_STATE.ASK_INSTAGRAM,
        snap,
        { upsellAsked: true, declaredPaidAt: '2026-08-17T00:00:00.000Z' },
        'declared',
      ),
      FLOW_STATE.ASK_INSTAGRAM,
    );
    assert.equal(
      resolveJibaResumeState(FLOW_STATE.PENDING_REVIEW, snap, { upsellAsked: true }, 'unpaid'),
      FLOW_STATE.PENDING_REVIEW,
    );
  });
});

describe('collecting sequence', () => {
  it('places upsell after store confirmation and before license', () => {
    const upsell = jibaSequenceIndex(FLOW_STATE.ASK_UPSELL);
    const store = jibaSequenceIndex(FLOW_STATE.CONFIRM_STORE);
    const name = jibaSequenceIndex(FLOW_STATE.ASK_RECIPIENT_NAME);
    const license = jibaSequenceIndex(FLOW_STATE.ASK_CONTENT_LICENSE);
    assert.ok(name < store);
    assert.ok(store < upsell);
    assert.ok(upsell < license);
    assert.equal(isJibaUpsellBeforeShipping(FLOW_STATE.ASK_UPSELL), false);
    assert.deepEqual(
      JIBA_COLLECTING_SEQUENCE.slice(0, 9),
      [
        FLOW_STATE.CAMPAIGN_INTRO,
        FLOW_STATE.ASK_PRODUCT,
        FLOW_STATE.SHOW_BRIEF,
        FLOW_STATE.ASK_RECIPIENT_NAME,
        FLOW_STATE.ASK_RECIPIENT_PHONE,
        FLOW_STATE.ASK_STORE,
        FLOW_STATE.CONFIRM_STORE,
        FLOW_STATE.ASK_UPSELL,
        FLOW_STATE.ASK_TRANSFER,
      ],
    );
  });
});
