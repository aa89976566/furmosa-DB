import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isRegisterSessionExpired, REGISTER_SESSION_TTL_MS } from '../chat-session';
import {
  isRegisterNavLeaveText,
  registerStoreStepAction,
  resolveTypedSignupStoreFromStores,
} from '../register-from-chat';

describe('registerStoreStepAction', () => {
  it('取消時結束開戶流程', () => {
    assert.equal(registerStoreStepAction('取消'), 'cancel');
    assert.equal(registerStoreStepAction('cancel'), 'cancel');
  });

  it('一般文字應重送選店按鈕（不可清掉開戶 session）', () => {
    assert.equal(registerStoreStepAction('你好'), 'reprompt');
    assert.equal(registerStoreStepAction('35085664'), 'reprompt');
    assert.equal(registerStoreStepAction('毛孩來開箱'), 'reprompt');
    assert.equal(registerStoreStepAction(''), 'reprompt');
  });
});


describe('resolveTypedSignupStoreFromStores', () => {
  const stores = [
    { slug: 'senpet', name: '森的汪星' },
    { slug: 'manlisa', name: '曼莉莎寵物美容' },
    { slug: 'morphy', name: '墨菲寵物美學' },
  ];

  it('直接輸入完整店名可解析', () => {
    assert.equal(resolveTypedSignupStoreFromStores('森的汪星', stores), 'senpet');
    assert.equal(resolveTypedSignupStoreFromStores('曼莉莎寵物美容', stores), 'manlisa');
  });

  it('省略美容／美學字樣仍可在唯一匹配時解析', () => {
    assert.equal(resolveTypedSignupStoreFromStores('曼莉莎', stores), 'manlisa');
    assert.equal(resolveTypedSignupStoreFromStores('墨菲', stores), 'morphy');
  });

  it('slug 與常見空白標點輸入可解析，未知店名維持 null', () => {
    assert.equal(resolveTypedSignupStoreFromStores(' senpet ', stores), 'senpet');
    assert.equal(resolveTypedSignupStoreFromStores('森 的 汪 星', stores), 'senpet');
    assert.equal(resolveTypedSignupStoreFromStores('不存在的店', stores), null);
  });

  it('簡化名稱若有歧義，不可亂綁店', () => {
    const ambiguous = [
      { slug: 'a', name: '小白寵物美容' },
      { slug: 'b', name: '小白寵物美學' },
    ];
    assert.equal(resolveTypedSignupStoreFromStores('小白', ambiguous), null);
  });
});

describe('isRegisterNavLeaveText', () => {
  it('四格選單入口應離開開戶（含回家）', () => {
    assert.equal(isRegisterNavLeaveText('回家'), true);
    assert.equal(isRegisterNavLeaveText('還有很多故事'), true);
    assert.equal(isRegisterNavLeaveText('一起野放'), true);
    assert.equal(isRegisterNavLeaveText('預約美容'), true);
    assert.equal(isRegisterNavLeaveText('換罐計劃'), true);
  });

  it('換罐選單捷徑應離開開戶（含介紹）', () => {
    assert.equal(isRegisterNavLeaveText('什麼是換罐計劃？'), true);
    assert.equal(isRegisterNavLeaveText('介紹'), true);
    assert.equal(isRegisterNavLeaveText('毛爸媽常問'), true);
    assert.equal(isRegisterNavLeaveText('點數換折價'), true);
    assert.equal(isRegisterNavLeaveText('輸入序號'), true);
  });

  it('一般開戶輸入不應被當成導覽離開', () => {
    assert.equal(isRegisterNavLeaveText('小美'), false);
    assert.equal(isRegisterNavLeaveText('王小姐'), false);
    assert.equal(isRegisterNavLeaveText('0912345678'), false);
    assert.equal(isRegisterNavLeaveText('你好'), false);
  });
});


describe('isRegisterSessionExpired', () => {
  const now = new Date('2026-06-11T12:00:00Z');

  it('超過 30 分鐘視為過期', () => {
    const old = new Date(now.getTime() - REGISTER_SESSION_TTL_MS - 1000);
    assert.equal(isRegisterSessionExpired({ updatedAt: old }, now), true);
  });

  it('30 分鐘內仍有效', () => {
    const recent = new Date(now.getTime() - 10 * 60 * 1000);
    assert.equal(isRegisterSessionExpired({ updatedAt: recent }, now), false);
  });
});
