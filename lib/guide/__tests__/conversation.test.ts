import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile, mergeProfile, nextTurn, eligibleProducts, validateUnderstanding } from '../conversation.ts';
import type { Profile, Product, Understanding } from '../conversation.ts';
const input = (patch: Partial<Profile> = {}): Understanding => ({ profile: { ...emptyProfile(), ...patch }, medical: false, shopping: true, clearAvoid: false, clearRequirements: false });
const dog = { ...emptyProfile(), species: 'dog', need: 'training', category: 'food' as const };
const product: Product = { id: 'p1', title: '測試資料，非真實商品', url: 'https://furmosa.com/products/test', available: true, verified: true, species: ['dog'], needs: ['training'], category: 'food', ingredients: ['beef'], minAgeMonths: null, maxAgeMonths: null, verifiedClaims: [] };
test('首句完整提供兔兔與用途，不再問物種', () => {
  const r = nextTurn(emptyProfile(), input({ species: 'rabbit', need: 'chewing', category: 'toy' }), [product]);
  assert.equal(r.action, 'wish'); assert.equal(r.profile.species, 'rabbit'); assert.deepEqual(r.products, []);
});
test('追問只補缺值，物種持續保存', () => {
  const r = nextTurn({ ...emptyProfile(), species: 'rabbit' }, input({ need: 'chewing', category: 'toy' }), []);
  assert.equal(r.profile.species, 'rabbit'); assert.equal(r.action, 'wish');
});
test('換寵物清掉上一隻的年齡與飲食限制', () => {
  const p = mergeProfile({ ...dog, ageMonths: 180, avoid: ['chicken'] }, input({ species: 'rabbit' }));
  assert.equal(p.ageMonths, null); assert.deepEqual(p.avoid, []); assert.equal(p.need, null);
});
test('犬貓品不能推薦兔兔；未知適用或缺貨排除', () => {
  assert.deepEqual(eligibleProducts({ ...dog, species: 'rabbit' }, [product]), []);
  assert.deepEqual(eligibleProducts(dog, [{ ...product, verified: false }, { ...product, available: false }]), []);
});
test('避雞時排除含雞與成分不明，保留完整牛肉品', () => {
  const p = { ...dog, avoid: ['chicken'] };
  assert.equal(eligibleProducts(p, [product]).length, 1);
  assert.deepEqual(eligibleProducts(p, [{ ...product, ingredients: ['chicken'] }, { ...product, ingredients: null }]), []);
});
test('低脂與單一蛋白需求必須有驗證資料', () => {
  assert.deepEqual(eligibleProducts({ ...dog, requirements: ['low_fat'] }, [product]), []);
  assert.equal(eligibleProducts({ ...dog, requirements: ['low_fat'] }, [{ ...product, verifiedClaims: ['low_fat'] }]).length, 1);
});
test('已問過食材不重複問，年齡限制仍嚴格排除未知', () => {
  assert.equal(nextTurn(dog, input(), [product], ['avoid']).action, 'recommend');
  const p = { ...product, minAgeMonths: 12 };
  assert.equal(nextTurn(dog, input(), [p]).action, 'ask_age');
  assert.deepEqual(eligibleProducts(dog, [p]), []);
  assert.deepEqual(eligibleProducts({ ...dog, ageMonths: 6 }, [p]), []);
});
test('醫療問題轉人工／獸醫，不推商品', () => {
  assert.equal(nextTurn(dog, { ...input(), medical: true }, [product]).action, 'handoff');
});
test('拒絕不完整模型輸出與外部商品連結', () => {
  assert.throws(() => validateUnderstanding({ profile: { species: 'dog' } }));
  assert.deepEqual(eligibleProducts(dog, [{ ...product, url: 'https://furmosa.com.evil.test/products/x' }]), []);
});
