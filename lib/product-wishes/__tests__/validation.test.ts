import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseProductWish } from '../validation';

test('accepts a concise rabbit wish without contact data', () => {
  const result = parseProductWish({
    species: 'rabbit',
    intent: '日常點心',
    requestText: '低脂、適合磨牙的牧草點心',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.species, 'rabbit');
    assert.equal(result.value.requestText, '低脂、適合磨牙的牧草點心');
    assert.equal('lineId' in result.value, false);
  }
});

test('rejects unknown species and overlong wish text', () => {
  assert.equal(parseProductWish({ species: 'rabbit', requestText: 'x' }).ok, false);
  assert.equal(parseProductWish({
    species: 'unicorn',
    requestText: '想找小零食',
  }).ok, false);
  assert.equal(parseProductWish({
    species: 'rabbit',
    requestText: 'x'.repeat(281),
  }).ok, false);
});
