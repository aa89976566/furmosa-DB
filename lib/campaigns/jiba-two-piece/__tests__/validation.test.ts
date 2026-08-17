import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkRecipientName,
  isDeclineIntent,
  isJoinIntent,
  normalizeInstagramHandle,
  validPetNameOrSkip,
  validRecipientName,
  validRecipientPhone,
} from '../validation';
import { searchStoreCandidates } from '../store-search';
import { APP_STATUS, FLOW_STATE } from '../constants';

describe('jiba validation', () => {
  it('accepts taiwan mobile', () => {
    assert.equal(validRecipientPhone('0912-345-678'), '0912345678');
    assert.equal(validRecipientPhone('091234567'), null);
    assert.equal(validRecipientPhone('0812345678'), null);
  });

  it('validates recipient name and rejects menu intents', () => {
    assert.equal(validRecipientName('王小明'), '王小明');
    assert.equal(validRecipientName('陳美玲'), '陳美玲');
    assert.equal(validRecipientName('1'), null);
    assert.equal(validRecipientName('12345'), null);
    assert.equal(validRecipientName('好'), null);
    // 選單／參加意圖不可當姓名（先前會把「我要參加」寫進收件人）
    assert.equal(validRecipientName('我要參加'), null);
    assert.equal(validRecipientName('這個我可以！'), null);
    assert.equal(validRecipientName('可以'), null);
    assert.equal(validRecipientName('開箱任務'), null);
    assert.equal(validRecipientName('先看看規則'), null);
    assert.equal(validRecipientName('選貓草雞肉乾'), null);
    assert.equal(validRecipientName('選雞霸'), null);
    assert.equal(validRecipientName('選青蛙'), null);
    assert.equal(validRecipientName('先不用'), null);
    assert.equal(validRecipientName('開箱'), null);
    assert.equal(validRecipientName('ugc'), null);
    assert.equal(validRecipientName('我了解用途，開始填資料'), null);
    assert.equal(validRecipientName('好，開始填收件資訊'), null);
    assert.equal(validRecipientName('這次先不加'), null);
    assert.equal(validRecipientName('想加購'), null);
    assert.equal(validRecipientName('我已轉帳'), null);
    assert.equal(validRecipientName('選我已轉帳'), null);
    assert.equal(validRecipientName('@furmosa'), null);
    assert.equal(validRecipientName('0912345678'), null);
    const joinName = checkRecipientName('我要參加');
    assert.equal(joinName.ok, false);
    if (!joinName.ok) {
      assert.equal(joinName.reason, 'command');
    }
  });

  it('normalizes instagram handle', () => {
    assert.equal(normalizeInstagramHandle('@Furmosa_Food'), '@Furmosa_Food');
    assert.equal(normalizeInstagramHandle('furmosa'), null);
    assert.equal(normalizeInstagramHandle('＠pet.dog'), '@pet.dog');
    assert.equal(normalizeInstagramHandle('我要參加'), null);
  });

  it('validates pet name or skip', () => {
    assert.equal(validPetNameOrSkip('略過'), 'skip');
    assert.equal(validPetNameOrSkip('麻吉'), '麻吉');
    assert.equal(validPetNameOrSkip('我要參加'), null);
    assert.equal(validPetNameOrSkip(''), null);
  });

  it('matches join intents without random chat', () => {
    assert.equal(isJoinIntent('我要參加'), true);
    assert.equal(isJoinIntent('敢'), true);
    assert.equal(isJoinIntent('這個我可以！'), true);
    assert.equal(isJoinIntent('+1'), true);
    assert.equal(isJoinIntent('今天天氣不錯'), false);
    assert.equal(isJoinIntent('收件人王小明'), false);
  });

  it('matches decline', () => {
    assert.equal(isDeclineIntent('這次先不要'), true);
    assert.equal(isDeclineIntent('我再想一下'), true);
    assert.equal(isDeclineIntent('先不用'), true);
    assert.equal(isDeclineIntent('我要參加'), false);
  });
});

describe('store search', () => {
  it('returns candidates and never auto-finalizes free text alone', () => {
    const hits = searchStoreCandidates('板橋新埔');
    assert.ok(hits.length >= 1);
    assert.ok(hits.some((h) => h.storeName.includes('板橋') || h.storeName.includes('新埔')));
    const free = hits.find((h) => h.storeName.includes('板橋新埔') && !h.storeId);
    assert.ok(free || hits.some((h) => h.storeId));
  });
});

describe('status machine constants', () => {
  it('keeps review / await / ready statuses distinct', () => {
    assert.equal(APP_STATUS.PENDING_REVIEW, 'PENDING_REVIEW');
    assert.equal(APP_STATUS.AWAITING_SHIPPING_PAYMENT, 'AWAITING_SHIPPING_PAYMENT');
    assert.equal(APP_STATUS.READY_TO_SHIP, 'READY_TO_SHIP');
    assert.equal(FLOW_STATE.PENDING_REVIEW, 'PENDING_REVIEW');
    assert.equal(FLOW_STATE.ASK_UPSELL, 'ASK_UPSELL');
    assert.notEqual(APP_STATUS.PENDING_REVIEW, APP_STATUS.READY_TO_SHIP);
  });
});
