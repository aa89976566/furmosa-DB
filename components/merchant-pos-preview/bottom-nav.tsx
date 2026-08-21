'use client';

import styles from '@/app/preview/merchant-pos/merchant-pos.module.css';
import { DIALOG_NAV_LABEL, TABS } from '@/lib/merchant-pos-preview/copy';
import type { TabId } from '@/lib/merchant-pos-preview/types';

const ITEMS: Array<{ id: TabId; label: string }> = [
  { id: 'checkout', label: TABS.checkout },
  { id: 'sales', label: TABS.sales },
  { id: 'refill', label: TABS.refill },
  { id: 'restock', label: TABS.restock },
  { id: 'points', label: TABS.points },
  { id: 'settlement', label: TABS.settlement },
];

export function PreviewBottomNav({
  tab,
  onChange,
}: {
  tab: TabId;
  onChange: (next: TabId) => void;
}) {
  return (
    <nav className={styles.bottomNav} aria-label={DIALOG_NAV_LABEL}>
      <div className={styles.bottomNavInner}>
        {ITEMS.map((item) => {
          const current = item.id === tab;
          return (
            <button
              key={item.id}
              type="button"
              className={`${styles.navBtn} ${current ? styles.navBtnCurrent : ''} min-h-[52px] min-w-[44px] focus-visible:ring-2`}
              aria-current={current ? 'page' : undefined}
              onClick={() => onChange(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className={styles.navSafe} />
    </nav>
  );
}
