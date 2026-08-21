'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  GROOMING_ENTRY_BODY,
  GROOMING_ENTRY_CTA,
  GROOMING_ENTRY_HINT,
  GROOMING_ENTRY_TITLE,
  GROOMING_PREVIEW_HREF,
  POINTS_REDEMPTION_INTRO,
} from '@/lib/merchant-pos-preview/copy';
import { PreviewActionLink } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { PreviewDisclosure } from './preview-disclosure';

export function PointsRedemptionPanel() {
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
          <PreviewActionLink
            tone={PREVIEW_ACTION_TONES.openGroomingVoucher}
            href={GROOMING_PREVIEW_HREF}
            className={`${styles.actionBlock} min-h-[44px] mt-3`}
          >
            {GROOMING_ENTRY_CTA}
          </PreviewActionLink>
          <div className="mt-3">
            <PreviewDisclosure summary="查看使用說明">
              <p>{GROOMING_ENTRY_BODY}</p>
              <p className="mt-1">{GROOMING_ENTRY_HINT}</p>
            </PreviewDisclosure>
          </div>
        </div>
      </div>
    </section>
  );
}
