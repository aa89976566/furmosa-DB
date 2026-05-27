import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLineUserText } from '../parse-message';

describe('parseLineUserText', () => {
  it('recognizes bind commands', () => {
    assert.equal(parseLineUserText('綁定 CUST-0001').kind, 'bind');
    assert.equal(parseLineUserText('綁定 0912345678').kind, 'bind');
  });

  it('recognizes bind help phrases', () => {
    assert.equal(parseLineUserText('如何綁定').kind, 'bind_help');
    assert.equal(parseLineUserText('怎麼綁定').kind, 'bind_help');
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
    assert.deepEqual(parseLineUserText('兌換 JAR-RWD-001'), {
      kind: 'redeem_reward',
      target: 'JAR-RWD-001',
    });
  });

  it('recognizes status and greeting', () => {
    assert.equal(parseLineUserText('會員').kind, 'status');
    assert.equal(parseLineUserText('你好').kind, 'greeting');
  });
});
