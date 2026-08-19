'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import {
  GROOMING_ENTRY_BODY,
  GROOMING_ENTRY_CTA,
  GROOMING_ENTRY_HINT,
  GROOMING_ENTRY_TITLE,
  GROOMING_PREVIEW_HREF,
  MORE_INTRO,
} from '@/lib/merchant-pos-preview/copy';
import { PreviewActionLink } from './preview-action';
import { PREVIEW_ACTION_TONES } from './preview-action-matrix';
import { SettlementPanel } from './settlement-panel';

export function MorePanel() {
  return (
    <section aria-labelledby="more-title" className="min-w-0 space-y-6">
      <div>
        <h2 id="more-title" className={styles.sectionTitle}>
          更多
        </h2>
        <p className={styles.sectionIntro}>{MORE_INTRO}</p>
      </div>

      <div className={styles.workspaceList}>
        <div className={styles.workspaceRow}>
          <h3 className={styles.productName}>{GROOMING_ENTRY_TITLE}</h3>
          <p className={`${styles.productSpec} mt-2`}>{GROOMING_ENTRY_BODY}</p>
          <p className={`${styles.hint} mt-2`}>{GROOMING_ENTRY_HINT}</p>
          <PreviewActionLink
            tone={PREVIEW_ACTION_TONES.openGroomingVoucher}
            href={GROOMING_PREVIEW_HREF}
            className={`${styles.actionBlock} min-h-[44px] mt-3`}
          >
            {GROOMING_ENTRY_CTA}
          </PreviewActionLink>
        </div>
      </div>

      <SettlementPanel />
    </section>
  );
}
