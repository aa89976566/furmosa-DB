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
