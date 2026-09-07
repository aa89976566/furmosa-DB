import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import Module, { createRequire, register } from 'node:module';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultReviewDraft, reviewLineDisplays } from '../review-defaults.ts';
import { reviewDraft, type ReviewDraft } from '../review-policy.ts';
import type { Snapshot } from '../../shopify/intake-policy.ts';
import { shopifySnapshot, stripPromotionCapture } from '../../shopify/intake-policy.ts';
import { buildFulfillmentPlan, type PromotionSummaryView } from '../fulfillment-plan.ts';
import { MOONCAKE_CATALOG } from '../../products/mooncake-catalog.ts';

const actionStub = { omsReviewAction: async () => ({ message: '' }) };
const load = (Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load.bind(Module);
(Module as typeof Module & { _load: (...args: unknown[]) => unknown })._load = function patchedLoad(request: unknown, ...rest: unknown[]) {
  if (String(request).includes('oms-actions')) return actionStub;
  return load(request, ...rest);
};
const loader = `
export async function resolve(specifier, context, nextResolve) {
  if (String(specifier).includes('oms-actions')) {
    return {
      shortCircuit: true,
      url: 'data:text/javascript,export async function omsReviewAction(){return {message:""}}',
    };
  }
  return nextResolve(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(loader)}`, import.meta.url);
assert.equal(existsSync(fileURLToPath(new URL('../../../components/orders/oms-review-form.tsx', import.meta.url))), true);

type FormProps = {
  orderId: string; sourceHash: string; status: string; draft: ReviewDraft;
  products: { id: string; name: string; sku: string }[];
  lineDisplays: ReturnType<typeof reviewLineDisplays>;
  promotionSummary?: PromotionSummaryView;
};
let Form: ComponentType<FormProps>;

async function loadForm() {
  if (!Form) {
    const require = createRequire(import.meta.url);
    const reactDom = require('react-dom') as { useFormState?: unknown; useFormStatus?: unknown };
    reactDom.useFormState = (_action: unknown, initial: unknown) => [initial, _action];
    reactDom.useFormStatus = () => ({ pending: false, data: null, method: null, action: null });
    (globalThis as typeof globalThis & { React?: unknown }).React = require('react');
    ({ OmsReviewForm: Form } = await import('../../../components/orders/oms-review-form.tsx'));
  }
  return Form;
}

const products = [{ id: 'p1', name: '冷凍商品', sku: 'SKU-FROZEN', sourceSku: null, defaultTemperature: 'frozen' }];

function snapshot(line: Record<string, unknown>): Snapshot {
  return { schemaVersion: 1, order: {
    id: '1', name: '#1', currency: 'TWD', total_price: '100.00',
    shipping_address: { name: '王小明', phone: '0912345678', city: '台北市', address1: '測試路 1 號' },
    line_items: [line],
    shipping_lines: [{ code: 'BLACKCAT_FROZEN', title: '黑貓冷凍宅配' }],
    note_attributes: [],
  } as never };
}

function htmlFor(FormComponent: ComponentType<FormProps>, source: Snapshot, draft: ReviewDraft, saved: ReviewDraft | null, status = 'NEW') {
  return renderToStaticMarkup(createElement(FormComponent, {
    orderId: 'o1', sourceHash: 'hash', status, draft, products,
    lineDisplays: reviewLineDisplays(source, products, draft, saved),
  }));
}

function productFieldset(html: string) {
  const match = html.match(/<fieldset[\s\S]*?<\/fieldset>/);
  assert.ok(match, html);
  return match[0];
}

function hasNamedSelect(markup: string, name: string) {
  return new RegExp(`<select[^>]*name="${name}"`).test(markup);
}

function hasHiddenProductId(markup: string, productId: string) {
  return /<input\b[^>]*type="hidden"[^>]*>/.test(markup)
    && markup.includes('name="productId"')
    && markup.includes(`value="${productId}"`)
    && !hasNamedSelect(markup, 'productId');
}

test('唯一 sku 自動對應渲染 ×10、SKU 自動對應與 hidden productId', async () => {
  const FormComponent = await loadForm();
  const source = snapshot({ title: '冷凍商品', sku: 'SKU-FROZEN', quantity: 10, price: '100.00' });
  const draft = defaultReviewDraft(source, products);
  const html = htmlFor(FormComponent, source, draft, null);
  const fieldset = productFieldset(html);
  assert.match(fieldset, /冷凍商品/);
  assert.match(fieldset, /×10/);
  assert.match(fieldset, /SKU 自動對應/);
  assert.equal(fieldset.includes('已保存對應'), false);
  assert.equal(hasHiddenProductId(fieldset, 'p1'), true);
  assert.match(html, /儲存並檢查/);
  assert.match(html, /name="lineTemperature"/);
  assert.match(htmlFor(FormComponent, source, draft, null, 'READY'), /建立 HQ 出貨單/);
});

test('唯一 sourceSku 同樣自動對應；大小寫不同則顯示人工 select', async () => {
  const FormComponent = await loadForm();
  const sourceSkuProduct = [{ id: 'p1', name: '冷凍商品', sku: 'HQ-1', sourceSku: 'SKU-FROZEN', defaultTemperature: 'frozen' }];
  const source = snapshot({ title: '冷凍商品', sku: 'SKU-FROZEN', quantity: 10, price: '100.00' });
  const draft = defaultReviewDraft(source, sourceSkuProduct);
  const html = renderToStaticMarkup(createElement(FormComponent, {
    orderId: 'o1', sourceHash: 'hash', status: 'NEW', draft, products: sourceSkuProduct,
    lineDisplays: reviewLineDisplays(source, sourceSkuProduct, draft, null),
  }));
  const fieldset = productFieldset(html);
  assert.match(fieldset, /SKU 自動對應/);
  assert.equal(hasHiddenProductId(fieldset, 'p1'), true);

  const caseSource = snapshot({ title: '冷凍商品', sku: 'sku-frozen', quantity: 10, price: '100.00' });
  const caseDraft = defaultReviewDraft(caseSource, products);
  const caseField = productFieldset(htmlFor(FormComponent, caseSource, caseDraft, null));
  assert.equal(caseDraft.lines[0]?.productId, '');
  assert.equal(hasNamedSelect(caseField, 'productId'), true);
  assert.equal(caseField.includes('SKU 自動對應'), false);
  assert.match(caseField, /×10/);
});

test('非法數量顯示數量待確認，不補 0；仍可保留正確 SKU 自動對應', async () => {
  const FormComponent = await loadForm();
  for (const quantity of [0, 0.5, -1, '10', 2147483648, undefined]) {
    const source = snapshot({ title: '冷凍商品', sku: 'SKU-FROZEN', quantity, price: '100.00' });
    const draft = defaultReviewDraft(source, products);
    const fieldset = productFieldset(htmlFor(FormComponent, source, draft, null));
    assert.match(fieldset, /數量待確認/);
    assert.equal(fieldset.includes('×0'), false);
    assert.equal(fieldset.includes('×10'), false);
    assert.match(fieldset, /SKU 自動對應/);
    assert.equal(hasHiddenProductId(fieldset, 'p1'), true);
  }
});

test('已保存且與唯一候選相同顯示已保存對應，不是自動對應', async () => {
  const FormComponent = await loadForm();
  const source = snapshot({ title: '冷凍商品', sku: 'SKU-FROZEN', quantity: 10, price: '100.00' });
  const saved = reviewDraft({
    lines: [{ productId: 'p1', temperature: 'frozen' }], method: 'home', temperature: 'frozen',
    recipient: '王小明', phone: '0912345678', address: '測試路 1 號',
  });
  const html = htmlFor(FormComponent, source, saved, saved, 'REVIEW');
  const fieldset = productFieldset(html);
  assert.match(fieldset, /已保存對應/);
  assert.equal(fieldset.includes('SKU 自動對應'), false);
  assert.equal(hasHiddenProductId(fieldset, 'p1'), true);
  assert.match(html, /確認訂單/);
});

test('已保存與候選不同時保留原值、select 與衝突說明，不鎖入 hidden', async () => {
  const FormComponent = await loadForm();
  const source = snapshot({ title: '冷凍商品', sku: 'SKU-FROZEN', quantity: 10, price: '100.00' });
  const saved = reviewDraft({
    lines: [{ productId: 'old', temperature: 'frozen' }], method: 'home', temperature: 'frozen',
    recipient: '王小明', phone: '0912345678', address: '測試路 1 號',
  });
  const fieldset = productFieldset(htmlFor(FormComponent, source, saved, saved));
  assert.match(fieldset, /已保存對應/);
  assert.match(fieldset, /不同/);
  assert.equal(hasNamedSelect(fieldset, 'productId'), true);
  assert.equal(/<option[^>]*value="old"[^>]*selected|<option[^>]*selected[^>]*value="old"/.test(fieldset), true);
  assert.equal(/<input\b[^>]*name="productId"/.test(fieldset), false);
  assert.equal(saved.lines[0]?.productId, 'old');
});

test('空 SKU、無匹配與多產品撞 SKU 都顯示人工 select', async () => {
  const FormComponent = await loadForm();
  const empty = snapshot({ title: '無 SKU', sku: '', quantity: 3, price: '100.00' });
  const emptyDraft = defaultReviewDraft(empty, products);
  const emptyField = productFieldset(htmlFor(FormComponent, empty, emptyDraft, null));
  assert.equal(hasNamedSelect(emptyField, 'productId'), true);
  assert.equal(emptyField.includes('SKU 自動對應'), false);
  assert.match(emptyField, /×3/);

  const missing = snapshot({ title: '未知', sku: 'NO-MATCH', quantity: 1, price: '100.00' });
  const missingDraft = defaultReviewDraft(missing, products);
  assert.equal(hasNamedSelect(productFieldset(htmlFor(FormComponent, missing, missingDraft, null)), 'productId'), true);

  const collided = [
    { id: 'p1', name: 'A', sku: 'SKU-FROZEN', sourceSku: null, defaultTemperature: 'frozen' },
    { id: 'p2', name: 'B', sku: 'OTHER', sourceSku: 'SKU-FROZEN', defaultTemperature: 'ambient' },
  ];
  const collideSource = snapshot({ title: '冷凍商品', sku: 'SKU-FROZEN', quantity: 4, price: '100.00' });
  const collideDraft = defaultReviewDraft(collideSource, collided);
  const collideHtml = renderToStaticMarkup(createElement(FormComponent, {
    orderId: 'o1', sourceHash: 'hash', status: 'NEW', draft: collideDraft, products: collided,
    lineDisplays: reviewLineDisplays(collideSource, collided, collideDraft, null),
  }));
  assert.equal(collideDraft.lines[0]?.productId, '');
  assert.equal(hasNamedSelect(productFieldset(collideHtml), 'productId'), true);
  assert.match(productFieldset(collideHtml), /×4/);
});

const mooncake = {
  id: 'ck08', name: MOONCAKE_CATALOG.name, sku: 'CK-08', sourceSku: 'CK-08',
  defaultTemperature: 'frozen', status: 'active', cost: 30, unit: '顆',
  productCategory: 'STANDARD', available: 20,
  priceTiers: [{ id: 't50', weightGrams: 50, unit: '顆', unitQty: 1, cost: 30 }],
};

function campaignSource(lines: Record<string, unknown>[], extra: Record<string, unknown> = {}): Snapshot {
  return shopifySnapshot({
    id: '1', name: '#1', currency: 'TWD', created_at: '2026-09-01T00:00:00+08:00',
    updated_at: '2026-09-01T01:00:00+08:00', financial_status: 'paid',
    subtotal_price: '790.00', total_discounts: '0.00', total_price: '790.00',
    total_shipping_price_set: { shop_money: { amount: '0.00' } },
    shipping_address: { name: '王小明', phone: '0912345678', city: '台北市', address1: '測試路 1 號' },
    line_items: lines, shipping_lines: [{ code: 'BLACKCAT_FROZEN', title: '黑貓冷凍宅配' }],
    ...extra,
  });
}

function htmlPlan(FormComponent: ComponentType<FormProps>, source: Snapshot, catalog: typeof mooncake[]) {
  const draft = defaultReviewDraft(source, catalog);
  const plan = buildFulfillmentPlan(source, draft, catalog);
  return renderToStaticMarkup(createElement(FormComponent, {
    orderId: 'o1', sourceHash: 'hash', status: 'NEW', draft,
    products: catalog, lineDisplays: reviewLineDisplays(source, catalog, draft, null),
    promotionSummary: plan.display,
  }));
}

test('HQ 補贈渲染購買10加贈1為11顆，並保留來源 ×10', async () => {
  const FormComponent = await loadForm();
  const source = campaignSource([{ title: '月餅', sku: 'CK-08', quantity: 10, price: '79.00' }]);
  const html = htmlPlan(FormComponent, source, [mooncake]);
  assert.match(html, /活動贈品：滿NT\$555贈月餅×1/);
  assert.match(html, /HQ補贈/);
  assert.match(html, /預計出貨 11 顆/);
  assert.match(productFieldset(html), /×10/);
  assert.equal(html.includes('預計出貨 12'), false);
});

test('Shopify 已有贈品不把 10+1 加成 12', async () => {
  const FormComponent = await loadForm();
  const source = campaignSource([
    { title: '月餅', sku: 'CK-08', quantity: 10, price: '79.00' },
    { title: '贈品', sku: 'CK-08', variant_id: '64368368517497', quantity: 1, price: '0.00' },
  ]);
  const html = htmlPlan(FormComponent, source, [mooncake]);
  assert.match(html, /Shopify已有/);
  assert.match(html, /預計出貨 11 顆/);
  assert.equal(html.includes('預計出貨 12'), false);
  assert.equal((html.match(/<fieldset/g) ?? []).length, 2);
});

test('拒領不補贈，阻擋時不顯示假的可出貨總數', async () => {
  const FormComponent = await loadForm();
  const declined = campaignSource(
    [{ title: '月餅', sku: 'CK-08', quantity: 10, price: '79.00' }],
    { note_attributes: [{ name: 'jc_mooncake_choice', value: 'decline' }] },
  );
  const declinedHtml = htmlPlan(FormComponent, declined, [mooncake]);
  assert.match(declinedHtml, /已拒領/);
  assert.match(declinedHtml, /預計出貨 10 顆/);
  assert.equal(declinedHtml.includes('HQ補贈'), false);

  const blocked = stripPromotionCapture(campaignSource([{ title: '飼料', sku: 'FD-01', quantity: 1, price: '555.00' }]));
  const blockedHtml = htmlPlan(FormComponent, blocked, [mooncake]);
  assert.match(blockedHtml, /待確認/);
  assert.match(blockedHtml, /總數待確認/);
  assert.equal(blockedHtml.includes('預計出貨 11'), false);
});
