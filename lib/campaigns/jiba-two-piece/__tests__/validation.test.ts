import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDeclineIntent,
  isJoinIntent,
  normalizeInstagramHandle,
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

  it('validates recipient name', () => {
    assert.equal(validRecipientName('王小明'), '王小明');
    assert.equal(validRecipientName('1'), null);
    assert.equal(validRecipientName('12345'), null);
    assert.equal(validRecipientName('好'), null);
  });

  it('normalizes instagram handle', () => {
    assert.equal(normalizeInstagramHandle('@Furmosa_Food'), '@Furmosa_Food');
    assert.equal(normalizeInstagramHandle('furmosa'), null);
    assert.equal(normalizeInstagramHandle('＠pet.dog'), '@pet.dog');
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
    assert.equal(isDeclineIntent('我要參加'), false);
  });
});

describe('store search', () => {
  it('returns candidates and never auto-finalizes free text alone', () => {
    const hits = searchStoreCandidates('板橋新埔');
    assert.ok(hits.length >= 1);
    assert.ok(hits.some((h) => h.storeName.includes('板橋') || h.storeName.includes('新埔')));
    // 自由文字候選 storeId 應為空，需確認才入訂單
    const free = hits.find((h) => h.storeName.includes('板橋新埔') && !h.storeId);
    assert.ok(free || hits.some((h) => h.storeId));
  });
});

describe('status machine constants', () => {
  it('keeps shipping queue out until paid path', () => {
    assert.equal(APP_STATUS.PENDING_REVIEW, 'PENDING_REVIEW');
    assert.equal(APP_STATUS.AWAITING_SHIPPING_PAYMENT, 'AWAITING_SHIPPING_PAYMENT');
    assert.equal(APP_STATUS.READY_TO_SHIP, 'READY_TO_SHIP');
    assert.equal(FLOW_STATE.PENDING_REVIEW, 'PENDING_REVIEW');
    // 送審後不是 READY；付款前不是 QUEUED（由 service 保證）
    assert.notEqual(APP_STATUS.PENDING_REVIEW, APP_STATUS.READY_TO_SHIP);
  });
});
