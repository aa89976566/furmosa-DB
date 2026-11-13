import test from 'node:test';
import assert from 'node:assert/strict';
import { parseList, parseAnimal, planChanges, sourceUrl } from './source-sync.mjs';
const url = 'https://www.loverabbit.org/products/1/1';
const fixture = (status = '已開放領養') => `<div class="products-info"><h1>十一奉獻</h1><div class="product-text">送養狀態：${status}</div><div class="product-text">男生・已結紮</div><img data-src="/upload/rabbit.jpg"></div><div class="products-detail"><article itemprop="text">2026/10/21 回診。個性尚未公開。</article>`;
test('list ignores animal links in sidebar and follows matching region only', () => {
  const p = parseList('<aside><a href="/products_detail/999">sidebar</a></aside><ul class="product-list list-h"><li><a href="/products_detail/197">rabbit</a></li></ul><a href="/products/1/2">2</a><a href="/products/5/1">south</a>', url);
  assert.deepEqual(p.ids, ['197']); assert.deepEqual(p.pages, [url, 'https://www.loverabbit.org/products/1/2']);
});
test('empty or changed list markup fails closed', () => { assert.throws(() => parseList('<ul></ul>', url)); assert.throws(() => parseList('<ul class="product-list"></ul>', url)); });
test('detail preserves explicit limited qualification and source content', () => { const a = parseAnimal(fixture('限定資格領養'), '197'); assert.equal(a.status, '限定資格領養'); assert.equal(a.photos[0], 'https://www.loverabbit.org/upload/rabbit.jpg'); assert.match(a.description, /個性尚未公開/); });
test('unknown status cannot overwrite a known animal', () => assert.throws(() => parseAnimal(fixture('未知'), '197')));
test('dedup stable hash ignores unrelated navigation changes', () => assert.equal(parseAnimal(fixture(), '197').hash, parseAnimal('<nav>changed</nav>' + fixture(), '197').hash));
test('explicit closed status hides, while failures preserve', () => {
  const previous = [parseAnimal(fixture(), '197'), { id: '200', hash: 'old' }];
  const p = planChanges(previous, [parseAnimal(fixture('未開放領養'), '197')], { complete: false, failedIds: ['200'] });
  assert.deepEqual(p.changes.map(a => a.action), ['hide_explicit_status', 'preserve_fetch_failed']);
});
test('partial scan never treats absent IDs as removed', () => assert.equal(planChanges([{ id: '1' }], [], { complete: false }).changes[0].action, 'preserve_incomplete_scan'));
test('complete missing ID still requires direct verification', () => assert.equal(planChanges([{ id: '1' }], [], { complete: true }).changes[0].action, 'verify_missing_direct_page'));
test('bulk disappearance stops automatic removal decisions', () => { const p = planChanges(Array.from({ length: 20 }, (_, i) => ({ id: String(i) })), [], { complete: true }); assert.equal(p.suspicious, true); assert.ok(p.changes.every(a => a.action === 'preserve_incomplete_scan')); });
test('source requests reject foreign host and unrelated endpoints', () => { assert.throws(() => sourceUrl('https://example.com/products_detail/1')); assert.throws(() => sourceUrl('https://www.loverabbit.org/member')); });
