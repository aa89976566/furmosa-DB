'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  ClipboardCheck,
  PackageCheck,
  Search,
  Truck,
} from 'lucide-react';
import type { ReviewInboxItem, ReviewKind } from '@/lib/reviews/inbox';
import { formatDateTime } from '@/lib/format';
import styles from './review-workbench.module.css';

type ReviewCounts = Record<ReviewKind, number>;
type Filter = 'all' | ReviewKind;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'shopify_order', label: '訂單' },
  { key: 'ugc', label: 'UGC' },
  { key: 'restock', label: '補貨' },
  { key: 'partner', label: '店家合作' },
];

function amountLabel(value?: string) {
  if (!value) return null;
  const [currency, amount] = value.split(/\s+/);
  const raw = amount ?? currency?.replace(/^NT\$/, '');
  const numeric = Number(raw);
  if (!Number.isFinite(numeric)) return value;
  return `${amount ? `${currency} ` : 'NT$'}${numeric.toLocaleString('zh-TW')}`;
}

function deliveryLabel(address?: string) {
  if (!address) return '配送待確認';
  return /7-?11|全家|萊爾富|OK\s*超商/i.test(address) ? '超商取貨' : '宅配寄送';
}

function QueueItem({ item, active, onSelect }: { item: ReviewInboxItem; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" className={active ? `${styles.queueItem} ${styles.queueItemActive}` : styles.queueItem} onClick={onSelect}>
      <div className={styles.queueMeta}>
        <span className={styles.kind}>{item.kindLabel}</span>
        <span className={styles.status}>{item.statusLabel}</span>
        <time dateTime={item.createdAt.toISOString()}>{formatDateTime(item.createdAt)}</time>
      </div>
      <div className={styles.queueTitleRow}>
        <strong>{item.title}</strong>
        <ChevronRight aria-hidden />
      </div>
      <p>{item.subtitle || '等待人工確認'}</p>
    </button>
  );
}

function DetailPanel({ item }: { item: ReviewInboxItem }) {
  const lines = item.lines ?? [];
  const checks = item.preview?.checks ?? [];
  const warnings = checks.filter((check) => check.tone !== 'success');
  const completedChecks = checks.length - warnings.length;
  return (
    <section className={styles.detail} aria-label={`審核內容：${item.title}`}>
      <header className={styles.detailHeader}>
        <div>
          <div className={styles.detailEyebrow}>{item.kindLabel}</div>
          <h2>{item.title}</h2>
          <p>{item.subtitle || '請確認資料後進入審核'}</p>
        </div>
        <div className={styles.amountBlock}>
          <time dateTime={item.createdAt.toISOString()}>{formatDateTime(item.createdAt)}</time>
          {item.preview?.amount ? <strong>{amountLabel(item.preview.amount)}</strong> : null}
        </div>
      </header>

      {checks.length ? (
        <div className={warnings.length ? styles.reviewFocusWarning : styles.reviewFocusReady}>
          {warnings.length ? <AlertCircle aria-hidden /> : <Check aria-hidden />}
          <div>
            <strong>{warnings.length ? '需要人工判斷' : '基本資料已齊全'}</strong>
            <p>{warnings.length ? warnings.map((check) => `${check.label}：${check.detail}`).join('；') : `已完成 ${completedChecks} 項基本檢查，請核對備貨與配送。`}</p>
          </div>
        </div>
      ) : null}

      <div className={styles.detailBody}>
        <section className={`${styles.section} ${styles.pickSection}`}>
          <div className={styles.sectionHeading}>
            <h3><PackageCheck aria-hidden />本單要備貨</h3>
            <span>{lines.length} 項</span>
          </div>
          {lines.length ? (
            <ul className={styles.lines}>
              {lines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}
              {item.moreLabel ? <li className={styles.more}>{item.moreLabel}</li> : null}
            </ul>
          ) : (
            <p className={styles.placeholder}>開啟明細後核對完整內容。</p>
          )}
        </section>

        <section className={`${styles.section} ${styles.deliverySection}`}>
          <div className={styles.deliveryHeading}>
            <h3><Truck aria-hidden />配送票卡</h3>
            <span>{deliveryLabel(item.preview?.address)}</span>
          </div>
          <dl className={styles.deliveryFacts}>
            <div><dt>收件人</dt><dd>{item.preview?.customer || item.subtitle || '待確認'}</dd></div>
            {item.preview?.phone ? <div><dt>聯絡電話</dt><dd>{item.preview.phone}</dd></div> : null}
            <div className={styles.addressFact}><dt>寄送至</dt><dd>{item.preview?.address || '請在審核明細確認完整配送資料'}</dd></div>
          </dl>
        </section>

        <section className={styles.section}>
          <h3><ClipboardCheck aria-hidden />審核備註</h3>
          <div className={styles.note}>備註會在開啟審核後填寫，並保留於訂單歷程。</div>
        </section>
      </div>

      <footer className={styles.actionBar}>
        <p>所有正式核准、退回與庫存動作仍依原有審核規則執行。</p>
        <Link href={item.href} className={styles.primaryAction}>
          {item.actionLabel}<ArrowRight aria-hidden />
        </Link>
      </footer>
    </section>
  );
}

export function ReviewWorkbench({ items, counts }: { items: ReviewInboxItem[]; counts: ReviewCounts }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.kind !== filter) return false;
      if (!normalized) return true;
      return [item.title, item.subtitle, item.kindLabel, ...(item.lines ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    });
  }, [filter, items, query]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = filtered.find((item) => `${item.kind}-${item.id}` === selectedKey) ?? filtered[0] ?? null;
  const total = items.length;

  return (
    <div className={styles.workbench}>
      <section className={styles.metrics} aria-label="審核摘要">
        <div><ClipboardCheck aria-hidden /><span>待處理<strong>{total}</strong></span></div>
        <div><PackageCheck aria-hidden /><span>訂單<strong>{counts.shopify_order}</strong></span></div>
        <div><Truck aria-hidden /><span>其他申請<strong>{counts.ugc + counts.restock + counts.partner}</strong></span></div>
      </section>

      <div className={styles.tools}>
        <label className={styles.search}><Search aria-hidden /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋訂單、店家或申請人" /></label>
        <div className={styles.filters} aria-label="審核類型">
          {FILTERS.map((option) => {
            const count = option.key === 'all' ? total : counts[option.key];
            return <button key={option.key} type="button" className={filter === option.key ? styles.filterActive : styles.filter} onClick={() => setFilter(option.key)}>{option.label} <span>{count}</span></button>;
          })}
        </div>
      </div>

      {selected ? (
        <div className={styles.workspace}>
          <aside className={styles.queue}>
            <header><h2>待處理佇列</h2><span>{filtered.length} 筆</span></header>
            <div className={styles.queueList}>
              {filtered.map((item) => <QueueItem key={`${item.kind}-${item.id}`} item={item} active={selected.id === item.id && selected.kind === item.kind} onSelect={() => setSelectedKey(`${item.kind}-${item.id}`)} />)}
            </div>
          </aside>
          <DetailPanel item={selected} />
        </div>
      ) : (
        <section className={styles.empty}>沒有符合條件的待審核項目。</section>
      )}
    </div>
  );
}
