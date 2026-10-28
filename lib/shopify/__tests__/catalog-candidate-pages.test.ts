import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const detail = fs.readFileSync(path.join(root, 'app/(main)/products/shopify-candidates/[id]/page.tsx'), 'utf8');
const clientActions = fs.readFileSync(path.join(root, 'app/(main)/products/shopify-candidates/[id]/candidate-actions.tsx'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'app/(main)/products/shopify-candidates/actions.ts'), 'utf8');

test('candidate detail groups all variants and keeps create disabled', () => {
  assert.match(detail, /shopifyProductId: selected\.shopifyProductId/);
  assert.match(detail, /candidates\.map/);
  assert.match(detail, /尚未開放/);
  assert.doesNotMatch(detail, /href=\{`\/products\/new/);
});

test('candidate actions use live Shopify verification and server session actor', () => {
  assert.match(actions, /loadShopifyCatalogAudit/);
  assert.match(actions, /audit\.plan\.unmatchedShopifyVariants/);
  assert.match(actions, /getCurrentUser/);
  assert.match(actions, /actorId: actor\.id/);
  assert.doesNotMatch(actions, /formData\.get\('actorId'\)/);
  assert.match(actions, /existing\?\.resolution === 'linked' && existing\.linkedTierId === parsed\.data\.tierId/);
  assert.match(actions, /existing\?\.resolution === 'blocked' && existing\.notes === expectedNote/);
});

test('do-not-create copy preserves order blocking semantics', () => {
  assert.match(clientActions, /未對應訂單仍會保持阻擋/);
  assert.match(clientActions, /不會自動出貨或扣庫存/);
});
