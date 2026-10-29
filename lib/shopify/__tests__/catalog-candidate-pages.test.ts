import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const detail = fs.readFileSync(path.join(root, 'app/(main)/products/shopify-candidates/[id]/page.tsx'), 'utf8');
const clientActions = fs.readFileSync(path.join(root, 'app/(main)/products/shopify-candidates/[id]/candidate-actions.tsx'), 'utf8');
const actions = fs.readFileSync(path.join(root, 'app/(main)/products/shopify-candidates/actions.ts'), 'utf8');

test('candidate detail groups all variants and exposes guarded create', () => {
  assert.match(detail, /shopifyProductId: selected\.shopifyProductId/);
  assert.match(detail, /candidates\.map/);
  assert.match(detail, /CreateCandidateForm/);
  assert.match(detail, /同一個 Shopify 商品目前對應到不同 HQ 商品/);
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
  assert.match(actions, /createCatalogCandidate/);
  assert.match(actions, /actorId: actor\.id/);
});

test('do-not-create copy preserves order blocking semantics', () => {
  assert.match(clientActions, /未對應訂單仍會保持阻擋/);
  assert.match(clientActions, /不會自動出貨或扣庫存/);
});

test('create UX distinguishes catalog creation from inventory receipt', () => {
  assert.match(clientActions, /庫存維持 0/);
  assert.match(clientActions, /整包進貨成本/);
  assert.match(clientActions, /不是 Shopify 售價/);
  assert.match(clientActions, /Shopify 與訂單狀態不會自動修改/);
});

test('legacy sheet reference is resolved on the server only for unmatched candidates', () => {
  assert.match(detail, /resolveLegacyCatalogReference/);
  assert.match(detail, /candidate\.resolution === 'pending' && exact\.length === 0/);
  assert.match(detail, /舊表參考（不會自動寫入）/);
  assert.match(detail, /依完全相同的商品名稱參考/);
  assert.match(detail, /Shopify 標題結尾/);
  assert.match(detail, /僅作填寫參考/);
  assert.doesNotMatch(clientActions, /legacy-catalog-reference/);
  assert.doesNotMatch(clientActions, /legacy-sheet-catalog-reference\.snapshot/);
});

test('prefill remains editable and does not add legacy identity fields to the action payload', () => {
  assert.match(clientActions, /由 Shopify 規格解析，送出前請確認/);
  assert.match(clientActions, /舊表帶入，送出前請確認/);
  assert.match(clientActions, /name="candidateId"/);
  assert.match(clientActions, /name="expectedFingerprint"/);
  assert.match(clientActions, /name="mode"/);
  assert.doesNotMatch(clientActions, /name="(?:sourceSku|legacySku|legacySource|sheetRow)"/);
  assert.doesNotMatch(actions, /legacy-catalog-reference/);
});

test('unique canonical product name can target an existing HQ product without trusting legacy SKU', () => {
  assert.match(detail, /nameMatchedProducts\.length === 1/);
  assert.match(detail, /normalizeLegacyProductName\(product\.name\)/);
  assert.match(detail, /targetProductId=\{!parentProduct && suggestedProduct/);
  assert.match(clientActions, /name="targetProductId"/);
  assert.match(actions, /targetProductId: formData\.get\('targetProductId'\)/);
});

test('create form field names stay exactly compatible with the existing server action', () => {
  const createFormSource = clientActions.slice(clientActions.indexOf('export function CreateCandidateForm'));
  const fieldNames = [...createFormSource.matchAll(/name="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual([...new Set(fieldNames)].sort(), [
    'candidateId', 'category', 'cost', 'expectedFingerprint', 'mode', 'targetProductId', 'unit', 'unitQty', 'weightGrams',
  ]);
});
