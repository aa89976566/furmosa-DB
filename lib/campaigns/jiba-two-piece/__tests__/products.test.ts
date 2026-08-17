import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CATNIP_CHICK_HOMEPAGE_URL,
  JIBA_PRODUCTS,
  jibaProductKeyFromCollected,
  jibaProductLabelFromCollected,
  parseJibaProductKey,
} from '../constants';
import {
  JIBA_BRIEF_CONTINUE,
  JIBA_CATNIP_PURPOSE_CONTINUE,
  JIBA_INTRO,
  JIBA_LICENSE_BODY,
  JIBA_PRODUCT_PICKED,
  JIBA_RULES,
  jibaBriefAndUpsell,
  jibaBriefContinueLabel,
  jibaLicenseBody,
  isJibaBriefContinue,
} from '../copy';
import { validRecipientName } from '../validation';

describe('jiba unbox products', () => {
  it('keeps existing jiba and frog keys and adds catnip', () => {
    assert.equal(CATNIP_CHICK_HOMEPAGE_URL, 'https://catnip-chick.vercel.app/?cat=1');
    assert.deepEqual(Object.keys(JIBA_PRODUCTS), ['jiba', 'frog', 'catnip']);
    assert.equal(JIBA_PRODUCTS.jiba.orderLabel, '壕大大雞霸 × 2');
    assert.equal(JIBA_PRODUCTS.frog.orderLabel, '青蛙凍乾 × 1');
    assert.equal(JIBA_PRODUCTS.catnip.label, '貓草雞肉乾 30g');
    assert.equal(JIBA_PRODUCTS.catnip.orderLabel, '貓草雞肉乾 30g');
  });

  it('parses product buttons without mixing items', () => {
    assert.equal(parseJibaProductKey('選雞霸兩片'), 'jiba');
    assert.equal(parseJibaProductKey('選青蛙凍乾'), 'frog');
    assert.equal(parseJibaProductKey('選貓草雞肉乾'), 'catnip');
    assert.equal(parseJibaProductKey('貓草雞肉乾 30g'), 'catnip');
    assert.equal(parseJibaProductKey('我要參加'), null);
    assert.equal(parseJibaProductKey('好，開始填資料'), null);
  });

  it('reads product from collectedDataJson and defaults to jiba', () => {
    assert.equal(jibaProductKeyFromCollected({ productKey: 'catnip' }), 'catnip');
    assert.equal(
      jibaProductLabelFromCollected('{"productKey":"frog"}'),
      '青蛙凍乾 × 1',
    );
    assert.equal(jibaProductLabelFromCollected('{}'), '壕大大雞霸 × 2');
    assert.equal(jibaProductLabelFromCollected('not-json'), '壕大大雞霸 × 2');
  });
});

describe('jiba unbox copy for catnip', () => {
  it('lists all three products in intro and rules', () => {
    assert.match(JIBA_INTRO, /壕大大雞霸兩片/);
    assert.match(JIBA_INTRO, /青蛙凍乾一隻/);
    assert.match(JIBA_INTRO, /貓草雞肉乾 30g/);
    assert.match(JIBA_RULES, /貓草雞肉乾 30g/);
    assert.equal(JIBA_PRODUCT_PICKED.catnip.includes('貓草雞肉乾 30g'), true);
  });

  it('only mentions homepage purpose on catnip brief and license', () => {
    const catnipBrief = jibaBriefAndUpsell('catnip');
    const jibaBrief = jibaBriefAndUpsell('jiba');
    const frogBrief = jibaBriefAndUpsell('frog');

    assert.match(catnipBrief, /真實反應/);
    assert.match(catnipBrief, /catnip-chick\.vercel\.app\/\?cat=1/);
    assert.match(catnipBrief, /滿 NT\$399/);
    assert.match(catnipBrief, /滿 NT\$886/);
    assert.doesNotMatch(jibaBrief, /catnip-chick/);
    assert.doesNotMatch(frogBrief, /catnip-chick/);
    assert.match(jibaBrief, /壕大大雞霸 × 2/);
    assert.match(frogBrief, /青蛙凍乾 × 1/);

    assert.equal(jibaLicenseBody('jiba'), JIBA_LICENSE_BODY);
    assert.equal(jibaLicenseBody('frog'), JIBA_LICENSE_BODY);
    assert.match(jibaLicenseBody('catnip'), /我同意/);
    assert.match(jibaLicenseBody('catnip'), /catnip-chick\.vercel\.app/);
  });

  it('uses a clearer continue label only for catnip', () => {
    assert.equal(jibaBriefContinueLabel('jiba'), JIBA_BRIEF_CONTINUE);
    assert.equal(jibaBriefContinueLabel('frog'), JIBA_BRIEF_CONTINUE);
    assert.equal(jibaBriefContinueLabel('catnip'), JIBA_CATNIP_PURPOSE_CONTINUE);
    assert.equal(isJibaBriefContinue('好，開始填資料'), true);
    assert.equal(isJibaBriefContinue('我了解用途，開始填資料'), true);
    assert.equal(isJibaBriefContinue('選貓草雞肉乾'), false);
  });

  it('rejects new product buttons as recipient name', () => {
    assert.equal(validRecipientName('選貓草雞肉乾'), null);
    assert.equal(validRecipientName('我了解用途，開始填資料'), null);
    assert.equal(validRecipientName('王小明'), '王小明');
  });
});
