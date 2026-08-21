'use client';

import { useState } from 'react';
import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  GROOMING_ENTRY_BODY,
  GROOMING_ENTRY_CTA,
  GROOMING_ENTRY_HINT,
  GROOMING_ENTRY_TITLE,
  POINTS_REDEMPTION_CANCEL,
  POINTS_REDEMPTION_CONFIRM,
  POINTS_REDEMPTION_INTRO,
  POINTS_REDEMPTION_SUCCESS,
} from '@/lib/merchant-pos-preview/copy';
import { PreviewAction } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDisclosure } from './preview-disclosure';
import { PreviewDialog } from './preview-dialog';

export function PointsRedemptionPanel() {
  const [open, setOpen] = useState(false);
  const [redeemed, setRedeemed] = useState(false);

  return (
    <section aria-labelledby="points-title" className="min-w-0 space-y-6">
      <div className={styles.pageHeader}>
        <h2 id="points-title" className={styles.sectionTitle}>
          點數核銷
        </h2>
        <p className={styles.sectionIntro}>{POINTS_REDEMPTION_INTRO}</p>
      </div>

      <div className={styles.utilityGrid}>
        <div className={styles.workspaceCard}>
          <h3 className={styles.productName}>{GROOMING_ENTRY_TITLE}</h3>
          <p className={`${styles.productSpec} mt-2`}>10 點美容服務券核銷</p>
          <p className={`${styles.statusPill} mt-3`} role="status">
            {redeemed ? '已核銷（預覽）' : '10 點可兌換'}
          </p>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.openGroomingVoucher}
            className={`${styles.actionBlock} min-h-[44px] mt-3`}
            disabled={redeemed}
            onClick={() => setOpen(true)}
          >
            {GROOMING_ENTRY_CTA}
          </PreviewAction>
          <div className="mt-3">
            <PreviewDisclosure summary="查看使用說明">
              <p>{GROOMING_ENTRY_BODY}</p>
              <p className="mt-1">{GROOMING_ENTRY_HINT}</p>
            </PreviewDisclosure>
          </div>
        </div>
      </div>

      <PreviewDialog
        open={open}
        titleId="points-redemption-title"
        title="點數核銷"
        presentation="drawer"
        onClose={() => setOpen(false)}
      >
        <div className={styles.drawerBody}>
          <dl className={styles.defList}>
            <div className={styles.defRow}><dt>會員</dt><dd>示意會員</dd></div>
            <div className={styles.defRow}><dt>可用點數</dt><dd>10 點</dd></div>
            <div className={styles.defRow}><dt>兌換項目</dt><dd>美容服務券</dd></div>
            <div className={styles.defRow}><dt>資料狀態</dt><dd>僅供操作預覽</dd></div>
          </dl>
          <p className={styles.quietNote}>{GROOMING_ENTRY_HINT}</p>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.openGroomingVoucher}
            className={styles.actionBlock}
            onClick={() => {
              setRedeemed(true);
              setOpen(false);
            }}
          >
            {POINTS_REDEMPTION_CONFIRM}
          </PreviewAction>
          <PreviewAction
            tone={PREVIEW_ACTION_TONES.refundCancel}
            className={styles.actionBlock}
            onClick={() => setOpen(false)}
          >
            {POINTS_REDEMPTION_CANCEL}
          </PreviewAction>
        </div>
      </PreviewDialog>

      {redeemed ? <p className={styles.notice}>{POINTS_REDEMPTION_SUCCESS}</p> : null}
    </section>
  );
}
