import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const formSource = readFileSync(
  new URL('../../../components/orders/oms-review-form.tsx', import.meta.url),
  'utf8',
);
const panelSource = readFileSync(
  new URL('../../../components/orders/oms-review-panel.tsx', import.meta.url),
  'utf8',
);
const actionSource = readFileSync(
  new URL('../../../app/(main)/orders/oms-actions.ts', import.meta.url),
  'utf8',
);
const serviceSource = readFileSync(
  new URL('../review-service.ts', import.meta.url),
  'utf8',
);
const pageSource = readFileSync(
  new URL('../../../app/(main)/orders/[id]/page.tsx', import.meta.url),
  'utf8',
);

test('審核結果保持可見，稽核紀錄更新不會重建表單', () => {
  assert.match(panelSource, /<OmsReviewForm key=\{hash\}/);
  assert.doesNotMatch(panelSource, /key=\{`\$\{hash\}-\$\{audit\?\.id/);
  assert.match(formSource, /role="status" aria-live="polite"/);
  assert.ok(formSource.indexOf('role="status"') < formSource.indexOf('<Actions status={status}'));
});

test('所有審核按鈕明確送出表單，並刷新待審核清單', () => {
  for (const action of ['check', 'approve', 'ship']) {
    assert.match(formSource, new RegExp(`type="submit" name="action" value="${action}"`));
  }
  assert.match(actionSource, /'\/reviews'/);
});

test('server action early returns use the full result shape and keep cache failures as success', () => {
  assert.match(actionSource, /ok: false, message: '請先登入 HQ', kind: 'error'/);
  assert.match(actionSource, /ok: false, message: '不支援的操作', kind: 'error'/);
  assert.ok(actionSource.indexOf('CACHE_REFRESH_FAILED') < actionSource.indexOf('return result'));
  assert.match(actionSource, /'\/reviews'/);
  assert.match(actionSource, /'\/dashboard'/);
  assert.match(actionSource, /'\/shipments'/);
});

test('review service keeps blockers as an array and does not join them', () => {
  assert.doesNotMatch(serviceSource, /blockers\.join\(/);
  assert.doesNotMatch(serviceSource, /join\('；'\)/);
});

test('shipping section is only added in the OMS branch', () => {
  const omsBranch = pageSource.indexOf('if (order.omsStatus) {');
  const shipping = pageSource.indexOf('id="oms-shipping"');
  const legacyReturn = pageSource.indexOf('return (', omsBranch);
  assert.ok(omsBranch >= 0);
  assert.ok(shipping > omsBranch);
  assert.ok(legacyReturn > shipping);
  assert.equal(pageSource.includes('id="oms-shipping"', shipping + 1), false);
});

test('Actions source order keeps the first status live region before the usage site', () => {
  const usage = formSource.indexOf('<Actions status={status}');
  const definition = formSource.indexOf('function Actions');
  assert.ok(definition >= 0 && definition < usage);
  assert.ok(formSource.indexOf('role="status" aria-live="polite"') < usage);
  assert.ok(formSource.indexOf('role="status"') < usage);
});
