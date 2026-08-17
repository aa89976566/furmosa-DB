import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isJarMenuLeaveText,
  isRegisterNavLeaveText,
  isUnboxLeaveText,
  SESSION_BYPASS_KINDS,
} from '../session-leave';

describe('session-leave', () => {
  it('換罐選單捷徑應讓開箱／開戶讓路', () => {
    assert.equal(isJarMenuLeaveText('什麼是換罐計劃？'), true);
    assert.equal(isJarMenuLeaveText('介紹'), true);
    assert.equal(isUnboxLeaveText('介紹'), true);
    assert.equal(isRegisterNavLeaveText('介紹'), true);
    assert.equal(isJarMenuLeaveText('毛爸媽常問'), true);
    assert.equal(isJarMenuLeaveText('Q&A'), true);
    assert.equal(isJarMenuLeaveText('點數換折價'), true);
    assert.equal(isJarMenuLeaveText('兌換優惠券'), true);
    assert.equal(isJarMenuLeaveText('幫毛孩開戶'), true);
    assert.equal(isJarMenuLeaveText('輸入序號'), true);
    assert.equal(isJarMenuLeaveText('輸入空罐序號'), true);
    assert.equal(isJarMenuLeaveText('線上預購換罐'), true);
    assert.equal(isJarMenuLeaveText('我要換罐'), true);
    assert.equal(isJarMenuLeaveText('了解更多'), true);
    assert.equal(isJarMenuLeaveText('開始換罐'), true);
  });

  it('一般門市關鍵字不應被當成導覽離開', () => {
    assert.equal(isJarMenuLeaveText('板橋新埔'), false);
    assert.equal(isUnboxLeaveText('板橋新埔門市'), false);
    assert.equal(isRegisterNavLeaveText('小美'), false);
  });

  it('立即開戶應讓開箱讓路（交給開戶流程）', () => {
    assert.equal(isUnboxLeaveText('立即開戶'), true);
    assert.equal(isJarMenuLeaveText('立即開戶'), true);
  });


  it('SESSION_BYPASS_KINDS 含介紹與換罐閘道', () => {
    assert.ok(SESSION_BYPASS_KINDS.has('jar_explain_intro'));
    assert.ok(SESSION_BYPASS_KINDS.has('jar_explain_faq'));
    assert.ok(SESSION_BYPASS_KINDS.has('redeem_coupon'));
    assert.ok(SESSION_BYPASS_KINDS.has('jar_start'));
    assert.ok(SESSION_BYPASS_KINDS.has('jar_refill'));
    assert.ok(SESSION_BYPASS_KINDS.has('jar_more'));
  });
});
