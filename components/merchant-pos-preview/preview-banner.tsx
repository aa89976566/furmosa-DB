import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import { PREVIEW_BANNER_PRIMARY, PREVIEW_BANNER_SECONDARY } from '@/lib/merchant-pos-preview/copy';

export function PreviewBanner() {
  return (
    <div role="status" className={styles.banner}>
      <p className={styles.bannerPrimary}>{PREVIEW_BANNER_PRIMARY}</p>
      <p className={styles.bannerSecondary}>{PREVIEW_BANNER_SECONDARY}</p>
    </div>
  );
}
