import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COPY } from '../copy';
import { getPreviewVoucher } from '../fixtures';
import {
  amountExceedsFace,
  closeReview,
  createPosSession,
  evaluateRedeemGate,
  finishRedeem,
  liveServiceTotalMessage,
  lookupVoucher,
  messageForBlock,
  openRedeemTask,
  openReview,
  parseIntegerAmount,
  posClerkStep,
  simulateScan,
  startRedeem,
  submitCancelRequest,
  switchFixture,
} from '../pos-logic';
import type { FixtureKey, PosSession } from '../types';

function readyToRedeem(fixtureKey: FixtureKey = 'available_200', total = '880'): PosSession {
  let session = createPosSession(fixtureKey);
  session = openRedeemTask(session);
  session = simulateScan(session);
  session = {
    ...session,
    serviceTotalInput: total,
    serviceConfirmed: true,
  };
  return session;
}

describe('grooming voucher POS preview logic', () => {
  it('switches fixtures and resets redeem fields', () => {
    let session = readyToRedeem('available_200');
    session = switchFixture(session, 'expired');
    assert.equal(session.fixtureKey, 'expired');
    assert.equal(session.serviceTotalInput, '');
    assert.equal(session.serviceConfirmed, false);
    assert.equal(session.redeemed, false);
    assert.equal(session.codeInput, '');
    assert.equal(session.step, 'lookup');
  });

  it('lookup surfaces each blocked fixture with Bark copy', () => {
    const cases: Array<[FixtureKey, string]> = [
      ['wrong_store', COPY.wrongStore],
      ['expired', COPY.expired],
      ['already_redeemed', COPY.alreadyRedeemed],
      ['offline', COPY.offline],
    ];
    for (const [key, expected] of cases) {
      let session = createPosSession(key);
      session = simulateScan(session);
      assert.equal(session.lookedUp, true);
      assert.equal(session.liveMessage, expected);
    }
  });

  it('offline lookup does not queue a write', () => {
    let session = createPosSession('offline');
    session = simulateScan(session);
    assert.equal(session.blockReason, 'offline');
    assert.equal(session.redeemed, false);
    assert.equal(session.submitting, false);
    assert.equal(session.receipt, null);
    const gate = evaluateRedeemGate(session, getPreviewVoucher('offline'));
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.reason, 'offline');
  });

  it('parses only positive integers', () => {
    assert.deepEqual(parseIntegerAmount('880'), { ok: true, value: 880 });
    assert.equal(parseIntegerAmount('').ok, false);
    assert.equal(parseIntegerAmount('  ').ok, false);
    assert.equal(parseIntegerAmount('200.5').ok, false);
    assert.equal(parseIntegerAmount('-1').ok, false);
    assert.equal(parseIntegerAmount('0').ok, false);
    assert.equal(parseIntegerAmount('NT$200').ok, false);
  });

  it('requires service total strictly greater than face value', () => {
    assert.equal(amountExceedsFace(201, 200), true);
    assert.equal(amountExceedsFace(200, 200), false);
    assert.equal(amountExceedsFace(199, 200), false);

    for (const total of ['200', '199', '0']) {
      const session = readyToRedeem('available_200', total);
      const gate = evaluateRedeemGate(session, getPreviewVoucher('available_200'));
      assert.equal(gate.ok, false);
      if (!gate.ok) assert.equal(gate.reason, total === '0' ? 'invalid_amount' : 'amount_not_greater');
    }

    const equal = openReview(readyToRedeem('available_200', '200'));
    assert.equal(equal.step, 'lookup');
    assert.equal(equal.liveMessage, COPY.amountNotGreater(200));

    const equal250 = openReview(readyToRedeem('available_250', '250'));
    assert.equal(equal250.liveMessage, COPY.amountNotGreater(250));

    const ok = openReview(readyToRedeem('available_200', '201'));
    assert.equal(ok.step, 'review');
  });

  it('live amount message flags equal and lower totals immediately', () => {
    assert.equal(liveServiceTotalMessage('', 200), null);
    assert.equal(liveServiceTotalMessage('200', 200), COPY.amountNotGreater(200));
    assert.equal(liveServiceTotalMessage('199', 200), COPY.amountNotGreater(200));
    assert.equal(liveServiceTotalMessage('250', 250), COPY.amountNotGreater(250));
    assert.equal(liveServiceTotalMessage('201', 200), null);
    assert.equal(liveServiceTotalMessage('12.5', 200), COPY.invalidAmount);
    assert.ok(COPY.amountNotGreater(200).includes('美容服務總額要高於 NT$200'));
    assert.ok(COPY.amountNotGreater(250).includes('美容服務總額要高於 NT$250'));
  });

  it('clerk steps stay 掃描 → 確認 → 完成', () => {
    const home = createPosSession();
    assert.equal(posClerkStep(home), 1);
    const lookup = openRedeemTask(home);
    assert.equal(posClerkStep(lookup), 1);
    const scanned = simulateScan(lookup);
    assert.equal(posClerkStep(scanned), 2);
    const receipt = finishRedeem(startRedeem(openReview(readyToRedeem())));
    assert.equal(posClerkStep(receipt), 3);
    assert.equal(posClerkStep(simulateScan(openRedeemTask(createPosSession('expired')))), 1);
  });

  it('requires the completed-service checkbox', () => {
    const session = {
      ...readyToRedeem('available_200', '880'),
      serviceConfirmed: false,
    };
    const blocked = openReview(session);
    assert.equal(blocked.step, 'lookup');
    assert.equal(blocked.liveMessage, COPY.serviceNotConfirmed);
  });

  it('blocks double submit and keeps a single receipt', () => {
    let session = openReview(readyToRedeem());
    session = startRedeem(session);
    assert.equal(session.submitting, true);
    const again = startRedeem(session);
    assert.equal(again.blockReason, 'duplicate_submit');
    assert.equal(again.liveMessage, COPY.duplicateSubmit);

    session = finishRedeem(session);
    assert.equal(session.redeemed, true);
    assert.equal(session.step, 'receipt');
    assert.ok(session.receipt);
    assert.equal(session.receipt?.reference, 'GV-RX-PREVIEW-200A');

    const afterDone = startRedeem(session);
    assert.equal(afterDone.blockReason, 'duplicate_submit');
    const finishAgain = finishRedeem(session);
    assert.equal(finishAgain.blockReason, 'duplicate_submit');
  });

  it('cancel requires a reason and never restores the voucher', () => {
    let session = finishRedeem(startRedeem(openReview(readyToRedeem())));
    assert.equal(session.redeemed, true);

    const missing = submitCancelRequest(session);
    assert.equal(missing.blockReason, 'cancel_reason_required');
    assert.equal(missing.cancelSubmitted, false);
    assert.equal(missing.redeemed, true);

    session = submitCancelRequest({
      ...session,
      cancelReason: '顧客當下說少做一項。',
    });
    assert.equal(session.cancelSubmitted, true);
    assert.equal(session.redeemed, true);
    assert.equal(session.liveMessage, COPY.cancelSubmitted);
    assert.ok(session.receipt);
  });

  it('closeReview does not drop a submit in flight', () => {
    let session = startRedeem(openReview(readyToRedeem()));
    session = closeReview(session);
    assert.equal(session.step, 'review');
    assert.equal(session.submitting, true);
  });

  it('lookup without a code asks for one', () => {
    const session = lookupVoucher(openRedeemTask(createPosSession()));
    assert.equal(session.liveMessage, COPY.codeRequired);
  });

  it('block messages stay color-independent text', () => {
    assert.ok(messageForBlock('wrong_store', 200).includes('不歸本店'));
    assert.ok(messageForBlock('amount_not_greater', 200).includes('NT$200'));
  });
});
