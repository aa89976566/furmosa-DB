import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BIRTHDAY_COPY,
  decideBirthdayStep,
  safeDecideBirthdayStep,
  type BirthdayParseResult,
} from '../register-birthday';

const NOW = new Date('2026-08-08T04:00:00.000Z');

describe('birthday 狀態機決策', () => {
  it('連續 3 次 invalid 都 stay；第 4 次 valid 才 advance', () => {
    const invalids = ['十一月一日', '2025/02/29', '20251101'];
    for (const input of invalids) {
      const d = decideBirthdayStep(input, NOW);
      assert.equal(d.action, 'stay');
      assert.equal(d.writeDb, false);
    }
    const ok = decideBirthdayStep('2020/5/6', NOW);
    assert.equal(ok.action, 'advance');
    if (ok.action === 'advance') {
      assert.equal(ok.petBirthday, '2020-05-06');
      assert.equal(ok.successMessage, BIRTHDAY_COPY.success);
      assert.equal(ok.writeDb, false);
    }
  });

  it('略過前進且不帶成功句；不寫 DB', () => {
    const d = decideBirthdayStep('略過', NOW);
    assert.equal(d.action, 'advance');
    if (d.action === 'advance') {
      assert.equal(d.petBirthday, null);
      assert.equal(d.successMessage, null);
      assert.equal(d.writeDb, false);
    }
  });

  it('forced parser exception → safeDecide 仍回覆一次 recover', () => {
    const exploding = (): BirthdayParseResult => {
      throw new Error('forced parser boom');
    };
    const d = safeDecideBirthdayStep('anything', NOW, exploding);
    assert.equal(d.action, 'stay');
    if (d.action === 'stay') {
      assert.equal(d.message, BIRTHDAY_COPY.recover);
      assert.equal(d.writeDb, false);
    }
  });

  it('每 event 決策恰好一則 message（stay）或一組 advance', () => {
    const stay = decideBirthdayStep('壞日期', NOW);
    assert.equal(stay.action, 'stay');
    if (stay.action === 'stay') assert.ok(stay.message.length > 0);
    const adv = decideBirthdayStep('109/5/6', NOW);
    assert.equal(adv.action, 'advance');
  });
});
