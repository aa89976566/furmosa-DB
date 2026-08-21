'use client';

import { useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  GROOMING_ENTRY_CTA,
  GROOMING_ENTRY_HINT,
  GROOMING_ENTRY_TITLE,
  POINTS_REDEMPTION_CANCEL,
  POINTS_REDEMPTION_CONFIRM,
  POINTS_REDEMPTION_INTRO,
  POINTS_REDEMPTION_SUCCESS,
} from '@/lib/merchant-pos-preview/copy';
import { parsePositiveIntTwd, parsePreviewCouponCode } from '@/lib/merchant-pos-preview/validators';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDialog } from './preview-dialog';

const DEMO_COUPON_CODE = 'FURMOSA-1234';
const DEMO_COUPON_FACE_TWD = 200;

export function PointsRedemptionPanel() {
  const [open, setOpen] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [serviceTotal, setServiceTotal] = useState('');
  const [serviceCompleted, setServiceCompleted] = useState(false);
  const [verified, setVerified] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function verifyCoupon() {
    const parsed = parsePreviewCouponCode(couponCode);
    if (!parsed.ok) {
      setError(parsed.error);
      setVerified(false);
      return;
    }
    if (parsed.value !== DEMO_COUPON_CODE) {
      setError('找不到這張示意美容服務券');
      setVerified(false);
      return;
    }
    setCouponCode(parsed.value);
    setVerified(true);
    setError(null);
  }

  function confirmRedemption() {
    const total = parsePositiveIntTwd(serviceTotal);
    if (!total.ok || total.value <= DEMO_COUPON_FACE_TWD) {
      setError(`美容服務金額必須大於 NT$${DEMO_COUPON_FACE_TWD}`);
      return;
    }
    if (!serviceCompleted) {
      setError('請先確認美容服務已完成');
      return;
    }
    setRedeemed(true);
    setOpen(false);
    setError(null);
  }

  return (
    <section aria-labelledby="points-title" className="min-w-0 space-y-6">
      <div className={styles.pageHeader}>
        <h2 id="points-title" className={styles.sectionTitle}>點數核銷</h2>
        <p className={styles.sectionIntro}>{POINTS_REDEMPTION_INTRO}</p>
      </div>

      <div className={styles.utilityGrid}>
        <div className={styles.workspaceCard}>
          <h3 className={styles.productName}>{GROOMING_ENTRY_TITLE}</h3>
          <p className={`${styles.productSpec} mt-2`}>會員已用 10 點兌換</p>
          <p className={`${styles.statusPill} mt-3`} role="status">
            {redeemed ? '已核銷（預覽）' : '等待輸入美容券碼'}
          </p>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.openGroomingVoucher}
            className={`${styles.actionBlock} min-h-[44px] mt-3`}
            disabled={redeemed}
            onClick={() => setOpen(true)}
          >
            {GROOMING_ENTRY_CTA}
          </PreviewAction>
        </div>
      </div>

      <PreviewDialog
        open={open}
        titleId="points-redemption-title"
        title="美容服務券核銷"
        presentation="drawer"
        onClose={() => setOpen(false)}
      >
        <div className={styles.drawerBody}>
          <div>
            <label className={styles.fieldLabel} htmlFor="preview-coupon-code">美容券碼</label>
            <input
              id="preview-coupon-code"
              className={styles.field}
              value={couponCode}
              onChange={(event) => {
                setCouponCode(event.target.value.toUpperCase());
                setVerified(false);
                setError(null);
              }}
              placeholder="FURMOSA-1234"
              autoComplete="off"
              aria-describedby={error ? 'voucher-redemption-error' : undefined}
            />
          </div>

          {!verified ? (
            <PreviewAction tone={PREVIEW_ACTION_TONES.verifyVoucher} className={styles.actionBlock} onClick={verifyCoupon}>
              驗證美容券
            </PreviewAction>
          ) : (
            <>
              <dl className={styles.defList}>
                <div className={styles.defRow}><dt>會員</dt><dd>示意會員</dd></div>
                <div className={styles.defRow}><dt>使用門市</dt><dd>測試門市</dd></div>
                <div className={styles.defRow}><dt>券面額</dt><dd>NT$200</dd></div>
                <div className={styles.defRow}><dt>有效期限</dt><dd>2026/09/18</dd></div>
                <div className={styles.defRow}><dt>狀態</dt><dd>可使用</dd></div>
              </dl>
              <div>
                <label className={styles.fieldLabel} htmlFor="preview-service-total">美容服務金額</label>
                <input
                  id="preview-service-total"
                  className={styles.field}
                  inputMode="numeric"
                  value={serviceTotal}
                  onChange={(event) => {
                    setServiceTotal(event.target.value);
                    setError(null);
                  }}
                  placeholder="需大於 NT$200"
                />
              </div>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={serviceCompleted} onChange={(event) => {
                  setServiceCompleted(event.target.checked);
                  setError(null);
                }} />
                <span>美容服務已完成</span>
              </label>
              <PreviewAction tone={PREVIEW_ACTION_TONES.openGroomingVoucher} className={styles.actionBlock} onClick={confirmRedemption}>
                {POINTS_REDEMPTION_CONFIRM}
              </PreviewAction>
            </>
          )}

          {error ? <p id="voucher-redemption-error" className={styles.errorText} role="alert">{error}</p> : null}
          <p className={styles.quietNote}>{GROOMING_ENTRY_HINT}</p>
          <PreviewAction tone={PREVIEW_ACTION_TONES.refundCancel} className={styles.actionBlock} onClick={() => setOpen(false)}>
            {POINTS_REDEMPTION_CANCEL}
          </PreviewAction>
        </div>
      </PreviewDialog>

      {redeemed ? <p className={styles.notice}>{POINTS_REDEMPTION_SUCCESS}</p> : null}
    </section>
  );
}
