import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  matchFurmosaComImage,
  resolveFurmosaProductImage,
} from '@/lib/pos/furmosa-com-images';

describe('matchFurmosaComImage', () => {
  it('matches HQ snack names to furmosa.com product photos', () => {
    assert.match(matchFurmosaComImage('雞霸') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('柳葉魚凍乾') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('豬耳朵片') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('豬耳朵條') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('雞肉丁凍乾') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('牛肉地瓜乾') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('雞肉南瓜乾') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('鴨喉嚨') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('鴨肉蘋果') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('鴨肉蘋果乾') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('混合蔬果凍乾') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('胡蘿蔔雞霸') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('貓草雞肉薄片') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('壕大大雞霸*原味') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('蔬果凍乾') ?? '', /cdn\.shopify\.com/);
    assert.match(matchFurmosaComImage('雞丁凍乾') ?? '', /cdn\.shopify\.com/);
  });

  it('does not invent a photo for unknown names', () => {
    assert.equal(matchFurmosaComImage('不存在的宇宙餅乾'), null);
    assert.equal(matchFurmosaComImage('南瓜凍乾'), null);
  });

  it('falls back to the stored url when the official catalog has no match', () => {
    assert.equal(
      resolveFurmosaProductImage('不存在的宇宙餅乾', 'https://example.com/x.jpg'),
      'https://example.com/x.jpg',
    );
  });
});
