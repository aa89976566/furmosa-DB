'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { ReviewInboxItem } from '@/lib/reviews/inbox';
import { formatDateTime } from '@/lib/format';
import styles from './review-resource-list.module.css';

function ItemLines({ item }: { item: ReviewInboxItem }) {
  if (!item.lines?.length) return null;
  return (
    <div className={styles.lines}>
      {item.lines.map((line, index) => {
        const separator = ' × ';
        const separatorIndex = line.lastIndexOf(separator);
        if (separatorIndex === -1) {
          return <div key={index} className={styles.line}><span>{line}</span></div>;
        }
        return (
          <div key={index} className={styles.line}>
            <span>{line.slice(0, separatorIndex)}</span>
            <span className={styles.qty}>{line.slice(separatorIndex + separator.length)}</span>
          </div>
        );
      })}
      {item.moreLabel ? <div className={styles.more}>{item.moreLabel}</div> : null}
    </div>
  );
}

export function ReviewResourceList({ items }: { items: ReviewInboxItem[] }) {
  if (items.length === 0) {
    return <section className={styles.empty}>目前沒有待處理項目</section>;
  }

  return (
    <section className={styles.list} aria-label="待處理項目">
      {items.map((item) => (
        <article key={`${item.kind}-${item.id}`} className={styles.row}>
          <div className={styles.identity}>
            <div className={styles.meta}>
              <span className={styles.kind}>{item.kindLabel}</span>
              <span className={styles.status}>{item.statusLabel}</span>
            </div>
            <Link href={item.href} className={styles.title}>
              {item.title}
            </Link>
            <p className={styles.subtitle}>{item.subtitle || '—'}</p>
            <ItemLines item={item} />
          </div>

          <time className={styles.time} dateTime={item.createdAt.toISOString()}>
            {formatDateTime(item.createdAt)}
          </time>

          <Link href={item.href} className={styles.action} aria-label={`${item.actionLabel}：${item.title}`}>
            <span>{item.actionLabel}</span>
            <ChevronRight aria-hidden />
          </Link>
        </article>
      ))}
    </section>
  );
}
