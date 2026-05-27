import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ecoNoteForJarCount,
  formatJarDepositSuccessMessage,
  formatSavingsStatusMessage,
} from '../jar-deposit-copy';
import { parseLineUserText } from '../parse-message';
import { CUSTOMER_ID_EXAMPLE } from '../../customers/customer-id';

describe('parseLineUserText', () => {
  it('recognizes bind commands', () => {
    assert.equal(parseLineUserText(`綁定 ${CUSTOMER_ID_EXAMPLE}`).kind, 'bind');
    assert.equal(parseLineUserText('綁定 0912345678').kind, 'bind');
  });

  it('recognizes plan B phrases', () => {
    assert.equal(parseLineUserText('開戶存罐罐').kind, 'bind_help');
    assert.equal(parseLineUserText('存罐攻略').kind, 'help');
    assert.equal(parseLineUserText('小金庫').kind, 'savings');
  });

  it('recognizes jar codes', () => {
    const parsed = parseLineUserText('35085664');
    assert.deepEqual(parsed, { kind: 'jar_code', code: '35085664' });
  });

  it('recognizes balance and help', () => {
    assert.equal(parseLineUserText('點數').kind, 'balance');
    assert.equal(parseLineUserText('說明').kind, 'help');
  });

  it('recognizes rewards and redeem', () => {
    assert.equal(parseLineUserText('獎勵').kind, 'rewards_list');
    assert.deepEqual(parseLineUserText('兌換 1'), { kind: 'redeem_reward', target: '1' });
  });
});

describe('jar deposit copy', () => {
  it('shows cumulative jars without preachy tone', () => {
    const msg = formatJarDepositSuccessMessage({
      customerName: '王小明',
      customerCode: 'furmosa-0001',
      pointsBalance: 20,
      jarsDeposited: 2,
      pointsEarnedThisTime: 10,
      code: '35085664',
    });
    assert.match(msg, /累積已換：2 罐/);
    assert.match(msg, /累積 2 罐/);
  });

  it('formats savings status for zero jars', () => {
    const msg = formatSavingsStatusMessage({
      customerName: '王小明',
      customerCode: 'furmosa-0001',
      pointsBalance: 0,
      jarsDeposited: 0,
    });
    assert.match(msg, /還沒存過罐/);
  });

  it('escalates eco notes by jar count', () => {
    assert.match(ecoNoteForJarCount(1)!, /第 1 罐/);
    assert.match(ecoNoteForJarCount(10)!, /10 罐/);
  });
});
