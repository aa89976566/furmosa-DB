import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const actions = fs.readFileSync('app/(main)/orders/oms-actions.ts', 'utf8');
const panel = fs.readFileSync('components/orders/oms-review-panel.tsx', 'utf8');

test('successful OMS transitions navigate to committed server state', () => {
  assert.match(actions, /result\.ok && result\.action === 'approve'.*redirect\(`\/orders\/\$\{field\('orderId'\)\}#oms-review`\)/s);
  assert.match(actions, /result\.ok && result\.action === 'ship'.*redirect\(`\/orders\/\$\{field\('orderId'\)\}#oms-shipping`\)/s);
});

test('READY review panel persistently explains the next action', () => {
  assert.match(panel, /id="oms-review"/);
  assert.match(panel, /status === 'READY'/);
  assert.match(panel, /訂單已確認/);
  assert.match(panel, /下一步：建立 HQ 出貨單/);
});
