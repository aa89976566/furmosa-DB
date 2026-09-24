import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const actions = readFileSync('app/(main)/orders/actions.ts', 'utf8');
const form = readFileSync('app/(main)/orders/new/order-form.tsx', 'utf8');
const parser = readFileSync('lib/orders/parse-order-form.ts', 'utf8');

test('新增訂單由伺服器解析商務條件，不信任畫面計算', () => {
  assert.match(parser, /resolveMerchantCommercialTerm\(/);
  assert.match(parser, /merchantProductAllowsMode\(prod, merchantOrderMode\)/);
  assert.match(parser, /調整本單條件時，請填寫|commercialOverride/);
});

test('訂單明細保存預設、實際值、來源與覆寫稽核快照', () => {
  for (const field of [
    'businessTierSnapshot',
    'commercialTermsVersionSnapshot',
    'commercialRuleSource',
    'defaultCommercialMode',
    'defaultCommercialValue',
    'appliedCommercialMode',
    'appliedCommercialValue',
    'commercialOverrideReason',
    'commercialOverrideById',
    'commercialOverrideAt',
  ]) {
    assert.match(actions, new RegExp(`${field}:`));
  }
});

test('畫面把特殊調整收在次要入口並要求填寫原因', () => {
  assert.match(form, /調整本單條件/);
  assert.match(form, /name="commercialOverrideReason"/);
  assert.match(form, /minLength=\{4\}/);
  assert.match(form, /showCommercialTerms=\{!isEdit\}/);
});
