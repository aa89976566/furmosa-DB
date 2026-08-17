import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CATNIP_CHICK_HOMEPAGE_URL,
  JIBA_PRODUCT_ACTION_TEXT,
  JIBA_PRODUCT_BUTTON_LABEL,
  JIBA_PRODUCTS,
  JIBA_SHIPPING_FEE,
  jibaProductKeyFromCollected,
  jibaProductLabelFromCollected,
  parseJibaProductKey,
  replaceJibaLegacyCatnipName,
} from '../constants';
import {
  JIBA_BRIEF_CONTINUE,
  JIBA_CATNIP_PURPOSE_CONTINUE,
  JIBA_INVITE_BODY,
  JIBA_INVITE_TITLE,
  JIBA_LICENSE_BODY,
  JIBA_PRODUCT_PICKED,
  JIBA_RULES,
  JIBA_UPSELL_BODY,
  jibaBriefAndUpsell,
  jibaBriefContinueLabel,
  jibaConfirmSummary,
  jibaLicenseBody,
  jibaProductBrief,
  isJibaBriefContinue,
} from '../copy';
import { validRecipientName } from '../validation';

describe('jiba unbox products', () => {
  it('keeps existing jiba and frog keys and adds catnip', () => {
    assert.equal(CATNIP_CHICK_HOMEPAGE_URL, 'https://catnip-chick.vercel.app/?cat=1');
    assert.deepEqual(Object.keys(JIBA_PRODUCTS), ['jiba', 'frog', 'catnip']);
    assert.equal(JIBA_PRODUCTS.jiba.orderLabel, '壕大大雞霸 × 2');
    assert.equal(JIBA_PRODUCTS.frog.orderLabel, '青蛙凍乾 × 1');
    assert.equal(JIBA_PRODUCTS.catnip.label, '貓草雞肉薄片 30g');
    assert.equal(JIBA_PRODUCTS.catnip.orderLabel, '貓草雞肉薄片 30g');
  });

  it('parses product buttons without mixing items', () => {
    assert.equal(parseJibaProductKey('選雞霸兩片'), 'jiba');
    assert.equal(parseJibaProductKey('選雞霸'), 'jiba');
    assert.equal(parseJibaProductKey('選青蛙凍乾'), 'frog');
    assert.equal(parseJibaProductKey('選青蛙'), 'frog');
    assert.equal(parseJibaProductKey('選貓草雞肉薄片'), 'catnip');
    assert.equal(parseJibaProductKey('貓草雞肉薄片 30g'), 'catnip');
    assert.equal(parseJibaProductKey('選貓草雞肉乾'), 'catnip');
    assert.equal(parseJibaProductKey('貓草雞肉乾 30g'), 'catnip');
    assert.equal(parseJibaProductKey('貓草雞肉乾30g'), 'catnip');
    assert.equal(parseJibaProductKey('我要參加'), null);
    assert.equal(parseJibaProductKey('好，開始填資料'), null);
    assert.equal(JIBA_PRODUCT_BUTTON_LABEL.jiba, '雞霸');
    assert.equal(JIBA_PRODUCT_BUTTON_LABEL.frog, '青蛙');
    assert.equal(JIBA_PRODUCT_BUTTON_LABEL.catnip, '貓草雞肉薄片 30g');
    assert.equal(JIBA_PRODUCT_ACTION_TEXT.jiba, '選雞霸');
    assert.equal(JIBA_PRODUCT_ACTION_TEXT.frog, '選青蛙');
    assert.equal(JIBA_PRODUCT_ACTION_TEXT.catnip, '選貓草雞肉薄片');
    assert.equal(replaceJibaLegacyCatnipName('開箱商品：貓草雞肉乾 30g'), '開箱商品：貓草雞肉薄片 30g');
    assert.equal(replaceJibaLegacyCatnipName('貓草雞肉乾'), '貓草雞肉薄片');
    assert.equal(replaceJibaLegacyCatnipName('蝶豆花雞肉薄片'), '蝶豆花雞肉薄片');
    assert.equal(replaceJibaLegacyCatnipName('貓草棒'), '貓草棒');
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
  it('keeps invite copy to a single decision without listing products', () => {
    assert.equal(JIBA_INVITE_TITLE, '毛孩開箱體驗募集');
    assert.match(JIBA_INVITE_BODY, /先審核，通過再安排寄出/);
    assert.match(JIBA_INVITE_BODY, new RegExp(`需自付 ${JIBA_SHIPPING_FEE} 元物流處理費`));
    assert.doesNotMatch(JIBA_INVITE_BODY, /雞霸|青蛙|貓草|授權|399|886|catnip-chick/);
    assert.match(JIBA_RULES, /貓草雞肉薄片 30g/);
    assert.equal(JIBA_PRODUCT_PICKED.catnip.includes('貓草雞肉薄片 30g'), true);
  });

  it('only mentions homepage purpose on catnip brief and license', () => {
    const catnipBrief = jibaProductBrief('catnip');
    const jibaBrief = jibaProductBrief('jiba');
    const frogBrief = jibaProductBrief('frog');

    assert.match(catnipBrief, /真實反應/);
    assert.match(catnipBrief, /catnip-chick\.vercel\.app\/\?cat=1/);
    assert.doesNotMatch(catnipBrief, /399|886|加購/);
    assert.doesNotMatch(jibaBrief, /catnip-chick|399|886|加購/);
    assert.doesNotMatch(frogBrief, /catnip-chick|399|886|加購/);
    assert.match(jibaBrief, /壕大大雞霸 × 2/);
    assert.match(frogBrief, /青蛙凍乾 × 1/);
    assert.equal(jibaBriefAndUpsell('catnip'), catnipBrief);

    assert.match(JIBA_UPSELL_BODY, /滿 NT\$399/);
    assert.match(JIBA_UPSELL_BODY, /滿 NT\$886/);
    assert.match(JIBA_UPSELL_BODY, new RegExp(`${JIBA_SHIPPING_FEE} 元物流處理費`));

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
    assert.equal(isJibaBriefContinue('好，開始填收件資訊'), true);
    assert.equal(isJibaBriefContinue('我了解用途，開始填資料'), true);
    assert.equal(isJibaBriefContinue('我了解用途，開始填收件資訊'), true);
    assert.equal(isJibaBriefContinue('選貓草雞肉薄片'), false);
    assert.equal(isJibaBriefContinue('選貓草雞肉乾'), false);
  });

  it('rejects new product buttons as recipient name', () => {
    assert.equal(validRecipientName('選貓草雞肉薄片'), null);
    assert.equal(validRecipientName('選貓草雞肉乾'), null);
    assert.equal(validRecipientName('我了解用途，開始填資料'), null);
    assert.equal(validRecipientName('好，開始填收件資訊'), null);
    assert.equal(validRecipientName('想加購'), null);
    assert.equal(validRecipientName('王小明'), '王小明');
  });

  it('confirm page shows new catnip name and charge labels', () => {
    const due = jibaConfirmSummary({
      recipientName: '測試收件人',
      recipientPhone: '0912000111',
      storeName: '測試門市',
      instagramHandle: '@test_pet',
      productLabel: '貓草雞肉乾 30g',
      shippingFeeLabel: `物流處理費 ${JIBA_SHIPPING_FEE} 元｜待申報`,
      shippingFeeKind: 'awaiting_declaration',
    });
    assert.match(due, /貓草雞肉薄片 30g/);
    assert.doesNotMatch(due, /貓草雞肉乾/);
    assert.match(due, /物流處理費 60 元｜待申報/);
    assert.doesNotMatch(due, /包郵/);

    const threshold = jibaConfirmSummary({
      recipientName: '測試收件人',
      recipientPhone: '0912000111',
      storeName: '測試門市',
      instagramHandle: '@test_pet',
      productLabel: '貓草雞肉薄片 30g',
      shippingFeeLabel: '加購達門檻｜免運',
      shippingFeeKind: 'free_threshold',
    });
    assert.match(threshold, /加購達門檻｜免運/);
    assert.match(threshold, /加購達門檻，不用轉帳/);
    assert.doesNotMatch(threshold, /物流處理費：免運$/m);
  });
});
