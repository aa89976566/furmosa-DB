import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  isJarMenuLeaveText,
  isRegisterNavLeaveText,
  isUnboxLeaveText,
  SESSION_BYPASS_KINDS,
} from '../session-leave';

describe('session-leave', () => {
  it('換罐選單「介紹」應讓開箱／開戶讓路', () => {
    assert.equal(isJarMenuLeaveText('介紹'), true);
    assert.equal(isUnboxLeaveText('介紹'), true);
    assert.equal(isRegisterNavLeaveText('介紹'), true);
    assert.equal(isJarMenuLeaveText('Q&A'), true);
    assert.equal(isJarMenuLeaveText('兌換優惠券'), true);
    assert.equal(isJarMenuLeaveText('幫毛孩開戶'), true);
    assert.equal(isJarMenuLeaveText('輸入序號'), true);
  });

  it('一般門市關鍵字不應被當成導覽離開', () => {
    assert.equal(isJarMenuLeaveText('板橋新埔'), false);
    assert.equal(isUnboxLeaveText('板橋新埔門市'), false);
    assert.equal(isRegisterNavLeaveText('王小姐'), false);
  });

  it('SESSION_BYPASS_KINDS 含介紹', () => {
    assert.ok(SESSION_BYPASS_KINDS.has('jar_explain_intro'));
    assert.ok(SESSION_BYPASS_KINDS.has('jar_explain_faq'));
    assert.ok(SESSION_BYPASS_KINDS.has('redeem_coupon'));
  });
});
