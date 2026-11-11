'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  ChevronRight,
  Search,
} from 'lucide-react';
import type { ReviewInboxItem, ReviewKind } from '@/lib/reviews/inbox';
import { formatDateTime } from '@/lib/format';
import styles from './review-workbench.module.css';
import { OrderDeletionForm } from '@/components/orders/order-deletion-form';

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
    <button type="button" aria-pressed={active} className={active ? `${styles.queueItem} ${styles.queueItemActive}` : styles.queueItem} onClick={onSelect}>
      <div className={styles.queueMeta}>
        <span className={styles.kind}>{item.kindLabel}</span>
        <span className={styles.status}>{item.statusLabel}</span>
        <time dateTime={item.createdAt.toISOString()}>{formatDateTime(item.createdAt)}</time>
      </div>
      <div className={styles.queueTitleRow}>
        <strong>{item.preview?.reference || item.title}</strong>
        <ChevronRight aria-hidden />
      </div>
      {item.preview?.reference && item.preview.customer ? <span className={styles.queueCustomer}>{item.preview.customer}</span> : null}
      <div className={styles.queueSummary}>
        <p>{item.subtitle || '等待人工確認'}</p>
        {item.preview?.amount ? <strong>{item.preview.adjusted ? <small className={styles.adjustedLabel}>HQ 調整後</small> : null}{amountLabel(item.preview.amount)}</strong> : null}
      </div>
    </button>
  );
}

function DetailPanel({ item, onBack }: { item: ReviewInboxItem; onBack: () => void }) {
  const lines = item.lines ?? [];
  const checks = item.preview?.checks ?? [];
  const warnings = checks.filter((check) => check.tone !== 'success');
  return (
    <section className={styles.detail} aria-label={`審核內容：${item.title}`}>
      <button type="button" className={styles.backToQueue} onClick={onBack}>返回待審核清單</button>
      <header className={styles.detailHeader}>
        <div>
          <div className={styles.detailEyebrow}>{item.kindLabel} · {item.statusLabel}</div>
          <h2>{item.preview?.reference ? `${item.preview.reference} · ${item.preview.customer || '收件人待確認'}` : item.title}</h2>
          {item.kind !== 'shopify_order' && item.subtitle ? <p>{item.subtitle}</p> : null}
        </div>
        <div className={styles.amountBlock}>
          <time dateTime={item.createdAt.toISOString()}>{formatDateTime(item.createdAt)}</time>
          {item.preview?.amount ? <strong>{item.preview.adjusted ? <small className={styles.adjustedLabel}>HQ 調整後</small> : null}{amountLabel(item.preview.amount)}</strong> : null}
        </div>
      </header>

      {warnings.length ? (
        <div className={styles.reviewFocusWarning}>
          <AlertCircle aria-hidden />
          <div>
            <strong>待確認事項</strong>
            <p>{warnings.map((check) => `${check.label}：${check.detail}`).join('；')}</p>
          </div>
        </div>
      ) : null}

      <div className={styles.detailBody}>
        <section className={`${styles.section} ${styles.pickSection}`}>
          <div className={styles.sectionHeading}>
            <h3>商品</h3>
            <span>{lines.length} 項</span>
          </div>
          {lines.length ? (
            <ul className={styles.lines}>
              {lines.map((line, index) => {
                const parts = line.match(/^(.*) × (\d+|—)$/);
                return <li key={`${line}-${index}`}>{parts ? <><span>{parts[1]}</span><span className={styles.lineQuantity}>× {parts[2]}</span></> : line}</li>;
              })}
              {item.moreLabel ? <li className={styles.more}>{item.moreLabel}</li> : null}
            </ul>
          ) : (
            <p className={styles.placeholder}>開啟明細後核對完整內容。</p>
          )}
        </section>

        <section className={`${styles.section} ${styles.deliverySection}`}>
          <div className={styles.deliveryHeading}>
            <h3>配送資料</h3>
            <span>{deliveryLabel(item.preview?.address)}</span>
          </div>
          <dl className={styles.deliveryFacts}>
            <div><dt>收件人</dt><dd>{item.preview?.customer || item.subtitle || '待確認'}</dd></div>
            {item.preview?.phone ? <div><dt>聯絡電話</dt><dd>{item.preview.phone}</dd></div> : null}
            <div className={styles.addressFact}><dt>寄送至</dt><dd>{item.preview?.address || '請在審核明細確認完整配送資料'}</dd></div>
          </dl>
        </section>

      </div>

      {item.kind === 'shopify_order' && item.supportsOrderDeletion ? (
        <div className={styles.secondaryActions}>
          <OrderDeletionForm key={item.id} orderId={item.id} orderNumber={item.title} deleted={false} />
        </div>
      ) : null}

      <footer className={styles.actionBar}>
        {/* Review forms must load fresh after an adjustment, including native select state. */}
        <a href={item.href} className={styles.primaryAction}>
          {item.actionLabel}<ArrowRight aria-hidden />
        </a>
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
    <div className={styles.workbench} data-mobile-detail={selectedKey && selected ? 'true' : 'false'}>
      <div className={styles.tools}>
        <label className={styles.search}><Search aria-hidden /><input aria-label="搜尋待審核項目" value={query} onChange={(event) => { setQuery(event.target.value); setSelectedKey(null); }} placeholder="搜尋訂單、店家或申請人" /></label>
        <div className={styles.filters} aria-label="審核類型">
          {FILTERS.map((option) => {
            const count = option.key === 'all' ? total : counts[option.key];
            return <button key={option.key} type="button" aria-pressed={filter === option.key} className={filter === option.key ? styles.filterActive : styles.filter} onClick={() => { setFilter(option.key); setSelectedKey(null); }}>{option.label} <span>{count}</span></button>;
          })}
        </div>
      </div>

      {selected ? (
        <div className={styles.workspace}>
          <aside className={styles.queue} aria-label="待審核清單">
            <header><h2>待處理佇列</h2><span>{filtered.length} 筆</span></header>
            <div className={styles.queueList}>
              {filtered.map((item) => <QueueItem key={`${item.kind}-${item.id}`} item={item} active={selected.id === item.id && selected.kind === item.kind} onSelect={() => setSelectedKey(`${item.kind}-${item.id}`)} />)}
            </div>
          </aside>
          <DetailPanel item={selected} onBack={() => setSelectedKey(null)} />
        </div>
      ) : (
        <section className={styles.empty}>沒有符合條件的待審核項目。</section>
      )}
    </div>
  );
}
