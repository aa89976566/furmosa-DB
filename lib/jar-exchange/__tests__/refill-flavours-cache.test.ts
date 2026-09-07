import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  getRefillPlanSettings,
  invalidateRefillPlanCache,
  listActiveRefillFlavours,
  resolveRefillHeroImage,
} from '../refill-flavours';

describe('refill plan read cache', () => {
  it('resolves removed default image without changing custom URLs', () => {
    assert.equal(resolveRefillHeroImage('/images/refill-plan/refill-flavours.jpg'), '/images/refill-plan/refill-flavours-v2.jpg');
    assert.equal(resolveRefillHeroImage(null), '/images/refill-plan/refill-flavours-v2.jpg');
    assert.equal(resolveRefillHeroImage('https://example.com/custom.jpg'), 'https://example.com/custom.jpg');
    assert.equal(resolveRefillHeroImage('/custom/refill-flavours.jpg'), '/custom/refill-flavours.jpg');
  });
  it('DB 不可達時仍回傳靜態 fallback（不 throw）', async () => {
    invalidateRefillPlanCache();
    const [settings, flavours] = await Promise.all([
      getRefillPlanSettings(),
      listActiveRefillFlavours(),
    ]);
    assert.ok(settings.heroImageUrl.includes('refill'));
    assert.equal(settings.firstJarPrice, 129);
    assert.ok(flavours.length >= 1);
    assert.ok(flavours[0]?.label);
  });

  it('第二次讀取走快取（同參考或同內容）', async () => {
    invalidateRefillPlanCache();
    const a = await getRefillPlanSettings();
    const b = await getRefillPlanSettings();
    assert.deepEqual(a, b);
    const f1 = await listActiveRefillFlavours();
    const f2 = await listActiveRefillFlavours();
    assert.deepEqual(f1, f2);
  });
});
