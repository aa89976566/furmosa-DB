import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildJarFlavourPickerMessages,
  buildJarFlavourPostbackData,
} from '@/lib/line/jar-flavour-picker';
import type { RefillFlavourView } from '@/lib/jar-exchange/refill-flavours';

const sampleFlavours: RefillFlavourView[] = [
  {
    id: '1',
    code: 'anchovy-15',
    name: '丁香魚凍乾',
    weightGrams: 15,
    imageUrl: null,
    isActive: true,
    availableFrom: null,
    availableUntil: null,
    sortOrder: 1,
    label: '丁香魚凍乾｜15g',
  },
  {
    id: '2',
    code: 'beef-20',
    name: '牛肉凍乾',
    weightGrams: 20,
    imageUrl: null,
    isActive: true,
    availableFrom: null,
    availableUntil: null,
    sortOrder: 2,
    label: '牛肉凍乾｜20g',
  },
];

describe('jar flavour picker', () => {
  it('builds postback with code and flavour', () => {
    const data = buildJarFlavourPostbackData('35085664', 'anchovy-15');
    const params = new URLSearchParams(data);
    assert.equal(params.get('jd'), 'jar_fl');
    assert.equal(params.get('c'), '35085664');
    assert.equal(params.get('f'), 'anchovy-15');
  });

  it('returns flex with one button per flavour', () => {
    const msgs = buildJarFlavourPickerMessages({
      code: '35085664',
      flavours: sampleFlavours,
    });
    assert.equal(msgs.length, 2);
    const flex = msgs[1];
    assert.equal(flex.type, 'flex');
    if (flex.type !== 'flex') return;
    const raw = JSON.stringify(flex.contents);
    assert.match(raw, /jd=jar_fl&c=35085664&f=anchovy-15/);
    assert.match(raw, /jd=jar_fl&c=35085664&f=beef-20/);
    assert.match(raw, /丁香魚凍乾/);
  });
});
