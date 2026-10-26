import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../app/(main)/orders/new/order-form.tsx', import.meta.url),
  'utf8',
);
const parser = readFileSync(new URL('../parse-order-form.ts', import.meta.url), 'utf8');

test('HQ 訂單贈品輸入實際總克數，並固定為單一出貨列', () => {
  assert.match(source, /aria-label="實際贈送克數"/);
  assert.match(source, /實際贈送總克數/);
  assert.match(source, /quantity: 1,[\s\S]*weightGrams: nextWeight \|\| null/);
});

test('伺服器不信任畫面成本，按商品規格重新換算贈品成本', () => {
  assert.match(parser, /resolveGiftWeightCost\(\{/);
  assert.match(parser, /tierCost: selectedGiftTier\.cost/);
  assert.match(parser, /it\.weightGrams = it\.giftWeightGrams/);
  assert.match(parser, /it\.quantity !== 1/);
});

test('一般商品與贈品都逐列送出單位，避免多列商品欄位錯位', () => {
  assert.match(source, /type="hidden" name="unit" value=\{it\.unit \?\? prod\?\.unit \?\? ''\}/);
});
