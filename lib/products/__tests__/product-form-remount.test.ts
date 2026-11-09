import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pageSource = readFileSync(
  new URL('../../../app/(main)/products/[id]/page.tsx', import.meta.url),
  'utf8',
);
const actionsSource = readFileSync(
  new URL('../../../app/(main)/products/actions.ts', import.meta.url),
  'utf8',
);

test('product form remounts when saved product data or commercial terms change', () => {
  const productForms = pageSource.match(/<ProductForm\b[\s\S]*?\/>/g) ?? [];

  assert.equal(productForms.length, 1, '商品詳情頁應只有一個 ProductForm');
  assert.match(
    productForms[0],
    /key=\{`\$\{product\.id\}:\$\{product\.updatedAt\.toISOString\(\)\}:\$\{product\.commercialTermsVersion \?\? 0\}`\}/,
  );
});


test('only a clean standard product exposes the unit correction gate', () => {
  assert.match(pageSource, /product\.productCategory === 'STANDARD'/);
  assert.match(pageSource, /product\.priceTiers\.length === 0/);
  assert.match(pageSource, /product\.inventoryBalances\.length === 0/);
  assert.match(pageSource, /product\.inventoryTransactions\.length === 0/);
  assert.match(pageSource, /canEditUnit=\{canEditUnit\}/);
  assert.match(actionsSource, /existing\.productCategory === 'STANDARD'/);
  assert.match(actionsSource, /existing\._count\.priceTiers === 0/);
  assert.match(actionsSource, /existing\._count\.inventoryBalances === 0/);
  assert.match(actionsSource, /existing\._count\.inventoryTransactions === 0/);
});
