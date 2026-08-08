import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  escapeForSafeDisplay,
  hasUsableCustomerName,
  sanitizeDisplayName,
  validateAndCleanName,
} from '../name';

describe('morning name sanitize', () => {
  it('清理 HTML／script 並限制長度', () => {
    const cleaned = sanitizeDisplayName('  <script>alert(1)</script>小美  ');
    assert.equal(cleaned.includes('<'), false);
    assert.equal(cleaned.includes('script'), false);
    assert.match(cleaned, /小美/);
  });

  it('拒絕 XSS 與空白暱稱', () => {
    assert.equal(validateAndCleanName('<img onerror=alert(1)>').ok, false);
    assert.equal(validateAndCleanName('   ').ok, false);
    assert.equal(validateAndCleanName('@@@').ok, false);
  });

  it('安全顯示跳脫', () => {
    assert.equal(escapeForSafeDisplay(`a<b>"c"`), 'a&lt;b&gt;&quot;c&quot;');
  });

  it('已有可用 Customer.name 不重問', () => {
    assert.equal(hasUsableCustomerName('小美'), true);
    assert.equal(hasUsableCustomerName(''), false);
  });
});
