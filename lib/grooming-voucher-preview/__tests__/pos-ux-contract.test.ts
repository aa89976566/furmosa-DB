import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  POS_CONFIRM_DATA,
  POS_MANUAL_CODE,
  POS_SCAN_QR,
  POS_STEP_CONFIRM,
  POS_STEP_DONE,
  POS_STEP_SCAN,
  POS_TEST_TOOLS_NOTE,
  POS_TEST_TOOLS_TITLE,
} from '../copy';

const src = readFileSync(
  path.join(process.cwd(), 'components/grooming-voucher-preview/pos-preview-app.tsx'),
  'utf8',
);
const hq = readFileSync(
  path.join(process.cwd(), 'components/grooming-voucher-preview/hq-preview-app.tsx'),
  'utf8',
);

describe('POS preview UX polish contract', () => {
  it('keeps test tools collapsed and marked as preview-only', () => {
    assert.match(src, /<details/);
    assert.equal(src.includes('open>'), false);
    assert.match(src, /POS_TEST_TOOLS_TITLE/);
    assert.match(src, /POS_TEST_TOOLS_NOTE/);
    assert.equal(POS_TEST_TOOLS_TITLE, '測試工具');
    assert.match(POS_TEST_TOOLS_NOTE, /正式 POS 不會有/);
  });

  it('shows the three clerk steps without a wizard', () => {
    assert.match(src, /POS_STEP_SCAN/);
    assert.match(src, /POS_STEP_CONFIRM/);
    assert.match(src, /POS_STEP_DONE/);
    assert.equal(POS_STEP_SCAN, '掃描券碼');
    assert.equal(POS_STEP_CONFIRM, '確認服務');
    assert.equal(POS_STEP_DONE, '完成');
    assert.match(src, /aria-label="核銷步驟"/);
    assert.equal(src.includes('wizard'), false);
  });

  it('makes scan the primary action and keeps scan simulated', () => {
    assert.match(src, /POS_SCAN_QR/);
    assert.match(src, /POS_MANUAL_CODE/);
    assert.equal(POS_SCAN_QR, '掃描 QR Code');
    assert.equal(POS_MANUAL_CODE, '手動輸入券碼');
    assert.match(src, /simulateScan/);
    assert.equal(src.includes('getUserMedia'), false);
    assert.equal(src.includes('navigator.mediaDevices'), false);
    assert.equal(src.includes('camera'), false);
  });

  it('uses a single primary confirm button and live amount prefix', () => {
    assert.match(src, /POS_CONFIRM_DATA/);
    assert.equal(POS_CONFIRM_DATA, '確認資料');
    assert.match(src, /COPY\.confirmRedeem/);
    assert.match(src, />NT\$</);
    assert.match(src, /liveServiceTotalMessage/);
    assert.match(src, /role="alert"/);
    assert.match(src, /id=\{POS_REDEEM_SUCCESS_FOCUS_ID\}/);
    assert.match(src, /redeemSuccessRef\.current\?\.focus\(\)/);
    assert.match(src, /aria-live="polite"/);
    assert.match(src, /min-h-11/);
    assert.equal(src.includes('檢查並核銷'), false);
  });

  it('does not change the HQ preview component', () => {
    assert.equal(hq.includes(POS_TEST_TOOLS_TITLE), false);
    assert.equal(hq.includes(POS_SCAN_QR), false);
    assert.equal(hq.includes(POS_CONFIRM_DATA), false);
  });
});
