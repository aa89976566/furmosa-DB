import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  accountLast5,
  readJibaTransferAccount,
} from '../transfer-env';

const FAKE_ACCOUNT = '00000999991';

describe('jiba transfer env', () => {
  it('reads only from env and returns last 5', () => {
    const result = readJibaTransferAccount({
      JIBA_TRANSFER_BANK_NAME: '測試銀行',
      JIBA_TRANSFER_BANK_CODE: '000',
      JIBA_TRANSFER_ACCOUNT: FAKE_ACCOUNT,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.bankName, '測試銀行');
      assert.equal(result.value.bankCode, '000');
      assert.equal(result.value.account, FAKE_ACCOUNT);
      assert.equal(result.value.accountLast5, '99991');
    }
    assert.equal(accountLast5(FAKE_ACCOUNT), '99991');
  });

  it('fails closed when any env is missing', () => {
    const result = readJibaTransferAccount({
      JIBA_TRANSFER_BANK_NAME: '測試銀行',
      JIBA_TRANSFER_BANK_CODE: '000',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.missing, ['JIBA_TRANSFER_ACCOUNT']);
    }
  });

  it('does not hardcode a numeric transfer account in campaign sources', () => {
    const files = [
      new URL('../constants.ts', import.meta.url),
      new URL('../copy.ts', import.meta.url),
      new URL('../transfer-env.ts', import.meta.url),
    ];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      assert.doesNotMatch(src, /account:\s*'[0-9]{8,}'/);
      assert.doesNotMatch(src, /account:\s*"[0-9]{8,}"/);
    }
    const envSrc = readFileSync(new URL('../transfer-env.ts', import.meta.url), 'utf8');
    assert.match(envSrc, /process\.env/);
    assert.match(envSrc, /JIBA_TRANSFER_ACCOUNT/);
  });
});
