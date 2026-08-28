import assert from 'node:assert/strict';
import test from 'node:test';
import { isTestJarMember } from '../member-campaign';

test('辨識明確的測試會員', () => {
  assert.equal(isTestJarMember({ name: 'test' }), true);
  assert.equal(isTestJarMember({ name: '正式會員', customerId: 'test-001' }), true);
  assert.equal(isTestJarMember({ name: '正式會員', tags: '["vip","test"]' }), true);
});
test('不會把姓名中包含 test 的正式會員誤判', () => {
  assert.equal(isTestJarMember({ name: 'Contest Winner', customerId: 'furmosa-001' }), false);
  assert.equal(isTestJarMember({ name: '吳小姐', tags: '["vip"]' }), false);
});
