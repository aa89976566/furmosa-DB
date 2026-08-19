import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JIBA_PREVIEW_STEP_LABELS,
  applyJibaPreviewInput,
  collectJibaPreviewBotMessages,
  createInitialJibaPreviewState,
  resetJibaPreviewState,
  runJibaPreviewHappyPath,
} from '@/lib/line/campaigns/jiba-unbox/preview-engine';
import {
  JIBA_PREVIEW_MOCK_INPUTS,
  extractFlexButtonLabels,
} from '@/lib/line/campaigns/jiba-unbox/preview-messages';
import {
  JIBA_PRODUCT_PICKED,
  JIBA_SUBMITTED,
  jibaBriefAndUpsell,
} from '@/lib/campaigns/jiba-two-piece/copy';
import { JIBA_PRODUCTS } from '@/lib/campaigns/jiba-two-piece/constants';

describe('jiba preview engine', () => {
  it('初始狀態為 intro，含封面／介紹／三鍵 Flex', () => {
    const state = createInitialJibaPreviewState();
    assert.equal(state.step, 'intro');
    assert.equal(state.productKey, null);
    assert.equal(state.transcript.length, 1);
    const msgs = state.transcript[0].messages;
    assert.equal(msgs[0]?.type, 'image');
    assert.equal(msgs[1]?.type, 'text');
    assert.equal(msgs[2]?.type, 'flex');
    const labels = extractFlexButtonLabels(msgs[2]!);
    assert.deepEqual(labels, ['我要參加', '先看看規則', '這次先不要']);
  });

  it('雞霸兩片 happy path：步驟順序、文案與商品標籤', () => {
    const state = runJibaPreviewHappyPath('jiba');
    assert.equal(state.step, 'submitted');
    assert.equal(state.productKey, 'jiba');
    assert.equal(state.recipientName, JIBA_PREVIEW_MOCK_INPUTS.recipientName);
    assert.equal(state.recipientPhone, JIBA_PREVIEW_MOCK_INPUTS.recipientPhone);
    assert.equal(state.storeName, '板橋新埔門市');
    assert.equal(state.instagramHandle, JIBA_PREVIEW_MOCK_INPUTS.instagramHandle);
    assert.equal(state.petName, JIBA_PREVIEW_MOCK_INPUTS.petName);

    const botTexts = collectJibaPreviewBotMessages(state)
      .filter((m) => m.type === 'text')
      .map((m) => m.text);
    assert.ok(botTexts.some((t) => t === JIBA_PRODUCT_PICKED.jiba));
    assert.ok(botTexts.some((t) => t.includes(jibaBriefAndUpsell('jiba').slice(0, 12))));
    assert.ok(botTexts.some((t) => t.includes(JIBA_PRODUCTS.jiba.orderLabel)));
    assert.ok(botTexts.some((t) => t === JIBA_SUBMITTED));

    const userTexts = state.transcript
      .filter((t) => t.role === 'user')
      .map((t) => t.userText);
    assert.deepEqual(userTexts, [
      '我要參加',
      '選雞霸兩片',
      '好，開始填資料',
      JIBA_PREVIEW_MOCK_INPUTS.recipientName,
      JIBA_PREVIEW_MOCK_INPUTS.recipientPhone,
      JIBA_PREVIEW_MOCK_INPUTS.storeQuery,
      JIBA_PREVIEW_MOCK_INPUTS.pickStoreText,
      JIBA_PREVIEW_MOCK_INPUTS.instagramHandle,
      JIBA_PREVIEW_MOCK_INPUTS.petName,
      '我同意',
      '資料正確，送出',
    ]);
  });

  it('青蛙凍乾路徑使用對應商品文案', () => {
    const state = runJibaPreviewHappyPath('frog');
    assert.equal(state.step, 'submitted');
    assert.equal(state.productKey, 'frog');
    const botTexts = collectJibaPreviewBotMessages(state)
      .filter((m) => m.type === 'text')
      .map((m) => m.text);
    assert.ok(botTexts.some((t) => t === JIBA_PRODUCT_PICKED.frog));
    assert.ok(botTexts.some((t) => t.includes(JIBA_PRODUCTS.frog.orderLabel)));
    assert.ok(!botTexts.some((t) => t === JIBA_PRODUCT_PICKED.jiba));
  });

  it('重設預覽回到 intro 並清空 mock 欄位', () => {
    const mid = applyJibaPreviewInput(
      applyJibaPreviewInput(createInitialJibaPreviewState(), '我要參加'),
      '選雞霸兩片',
    );
    assert.equal(mid.step, 'show_brief');
    const reset = resetJibaPreviewState();
    assert.equal(reset.step, 'intro');
    assert.equal(reset.productKey, null);
    assert.equal(reset.recipientName, '');
    assert.equal(reset.transcript.length, 1);
    assert.equal(JIBA_PREVIEW_STEP_LABELS.intro, '介紹');
  });

  it('授權 Flex 按鈕標籤正確，確認摘要含 JSON 可序列化 payload', () => {
    let state = createInitialJibaPreviewState();
    for (const input of [
      '我要參加',
      '選雞霸兩片',
      '好，開始填資料',
      JIBA_PREVIEW_MOCK_INPUTS.recipientName,
      JIBA_PREVIEW_MOCK_INPUTS.recipientPhone,
      JIBA_PREVIEW_MOCK_INPUTS.storeQuery,
      JIBA_PREVIEW_MOCK_INPUTS.pickStoreText,
      JIBA_PREVIEW_MOCK_INPUTS.instagramHandle,
      JIBA_PREVIEW_MOCK_INPUTS.petName,
    ]) {
      state = applyJibaPreviewInput(state, input);
    }
    assert.equal(state.step, 'ask_license');
    const licenseFlex = collectJibaPreviewBotMessages(state).find(
      (m) => m.type === 'flex' && m.altText === '投稿授權同意',
    );
    assert.ok(licenseFlex);
    assert.deepEqual(extractFlexButtonLabels(licenseFlex!), ['我同意', '不同意']);

    state = applyJibaPreviewInput(state, '我同意');
    assert.equal(state.step, 'confirm_order');
    const confirm = collectJibaPreviewBotMessages(state).at(-1);
    assert.equal(confirm?.type, 'text');
    const json = JSON.stringify(confirm);
    assert.match(json, /資料正確，送出/);
    assert.match(json, /壕大大雞霸/);
    assert.match(json, /quickReply/);
  });

  it('婉拒路徑結束於 declined', () => {
    const state = applyJibaPreviewInput(
      createInitialJibaPreviewState(),
      '這次先不要',
    );
    assert.equal(state.step, 'declined');
  });
});
