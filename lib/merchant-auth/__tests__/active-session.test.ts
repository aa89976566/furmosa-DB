import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isMerchantSessionAccountActive } from '../active-session';

const session = {
  merchantUserId: 'user-1', merchantId: 'merchant-1', username: 'store.one',
  type: 'merchant' as const, issuedAt: 1, expiresAt: 999,
};
const account = {
  id: 'user-1', merchantId: 'merchant-1', username: 'store.one', isActive: true,
  merchant: { status: 'active' },
};

describe('POS 工作階段狀態', () => {
  it('帳號與店家都啟用時有效', () => assert.equal(isMerchantSessionAccountActive(session, account), true));
  it('帳號停用後立即失效', () => assert.equal(isMerchantSessionAccountActive(session, { ...account, isActive: false }), false));
  it('店家停用後立即失效', () => assert.equal(isMerchantSessionAccountActive(session, { ...account, merchant: { status: 'inactive' } }), false));
  it('帳號不屬於工作階段店家時失效', () => assert.equal(isMerchantSessionAccountActive(session, { ...account, merchantId: 'merchant-2' }), false));
});

