import {
  filterQueryFeed,
  formatQueryWhen,
  type QueryFeedItem,
  type QueryKind,
} from '@/lib/pos/query-feed';

export type QueryKindFilterId = QueryKind | 'all';
export type QueryRecordsViewState = 'ready' | 'loading' | 'error';

export const QUERY_RECORDS_TITLE = '查詢紀錄';
export const QUERY_RECORDS_DESCRIPTION = '查找換罐、補貨和庫存異動。';
export const QUERY_SEARCH_LABEL = '搜尋商品、罐號、顧客姓名、補貨單號或狀態';
export const QUERY_SEARCH_HINT = '可搜尋商品名稱、罐號、顧客姓名、補貨單號和狀態。';
export const QUERY_EMPTY_ALL = '目前還沒有紀錄。';
export const QUERY_EMPTY_FILTERED = '找不到符合條件的紀錄。';
export const QUERY_ERROR_TITLE = '紀錄暫時讀取失敗';
export const QUERY_ERROR_HINT = '請再試一次。若持續出現，請聯絡總部。';
export const QUERY_CLEAR_FILTERS_LABEL = '清除搜尋與篩選';
export const QUERY_SEARCHING_PREFIX = '正在篩選';
export const QUERY_UNKNOWN_KIND_LABEL = '紀錄';
export const QUERY_UNKNOWN_STATUS_LABEL = '狀態不明';

/** UI 中文名稱；id 必須維持既有 query identity。 */
export const QUERY_KIND_FILTERS: { id: QueryKindFilterId; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'sale', label: '銷售' },
  { id: 'refill', label: '換罐' },
  { id: 'restock', label: '補貨' },
  { id: 'stock', label: '庫存異動' },
];

const STATUS_LABELS: Record<string, string> = {
  completed: '已完成',
  awaiting_extra_payment: '等待補差額',
  payment_pending: '尚未付款',
  processing: '處理中',
  draft: '草稿',
  submitted: '已送出',
  under_review: '公司確認中',
  approved: '已確認',
  converted_to_shipment: '備貨中',
  rejected: '需要調整',
  cancelled: '已取消',
};

export function visibleRecordText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  if (!text || text === 'undefined' || text === 'null' || text === 'NaN') return null;
  return text;
}

export function queryKindLabel(kind: unknown): string {
  const id = visibleRecordText(kind);
  if (!id) return QUERY_UNKNOWN_KIND_LABEL;
  const found = QUERY_KIND_FILTERS.find((item) => item.id === id);
  if (found && found.id !== 'all') return found.label;
  return QUERY_UNKNOWN_KIND_LABEL;
}

export function queryStatusLabel(status: unknown): string | null {
  const raw = visibleRecordText(status);
  if (!raw) return null;
  if (STATUS_LABELS[raw]) return STATUS_LABELS[raw];
  if (/[\u4e00-\u9fff]/.test(raw)) return raw;
  if (/^[a-z0-9_]+$/i.test(raw)) return QUERY_UNKNOWN_STATUS_LABEL;
  return raw;
}

export function queryWhenLabel(iso: unknown, now = new Date()): string | null {
  const raw = visibleRecordText(iso);
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return formatQueryWhen(date.toISOString(), now);
}

export function queryRecordHref(href: unknown): string | null {
  const raw = visibleRecordText(href);
  if (!raw) return null;
  if (!raw.startsWith('/pos') || raw.startsWith('/pos/login')) return null;
  return raw;
}

export type PresentedQueryRecord = {
  id: string;
  kindLabel: string;
  whenLabel: string | null;
  detail: string | null;
  extra: string | null;
  statusLabel: string | null;
  href: string | null;
};

export function presentQueryRecord(item: QueryFeedItem, now = new Date()): PresentedQueryRecord {
  const detail = visibleRecordText(item.title);
  const extra = visibleRecordText(item.subtitle);
  return {
    id: visibleRecordText(item.id) ?? 'record',
    kindLabel: queryKindLabel(item.kind),
    whenLabel: queryWhenLabel(item.at, now),
    detail,
    extra: extra === detail ? null : extra,
    statusLabel: queryStatusLabel(item.status),
    href: queryRecordHref(item.href),
  };
}

export function queryKindFilterIds(): QueryKindFilterId[] {
  return QUERY_KIND_FILTERS.map((item) => item.id);
}

export function hasQueryRecordsFilters(kind: QueryKindFilterId, query: string): boolean {
  return kind !== 'all' || query.trim().length > 0;
}

export function queryRecordsListMode(input: {
  state?: QueryRecordsViewState;
  items: QueryFeedItem[];
  kind: QueryKindFilterId;
  query: string;
}): {
  mode: 'loading' | 'error' | 'empty' | 'no_matches' | 'list';
  visible: QueryFeedItem[];
  emptyMessage: string | null;
  hasActiveFilters: boolean;
} {
  const state = input.state ?? 'ready';
  const hasActiveFilters = hasQueryRecordsFilters(input.kind, input.query);
  if (state === 'loading') {
    return { mode: 'loading', visible: [], emptyMessage: null, hasActiveFilters: false };
  }
  if (state === 'error') {
    return { mode: 'error', visible: [], emptyMessage: null, hasActiveFilters: false };
  }
  const visible = filterQueryFeed(input.items, input.kind, input.query);
  if (input.items.length === 0) {
    return {
      mode: 'empty',
      visible,
      emptyMessage: QUERY_EMPTY_ALL,
      hasActiveFilters,
    };
  }
  if (visible.length === 0) {
    return {
      mode: 'no_matches',
      visible,
      emptyMessage: QUERY_EMPTY_FILTERED,
      hasActiveFilters,
    };
  }
  return { mode: 'list', visible, emptyMessage: null, hasActiveFilters };
}

export function querySearchFeedback(query: string): string | null {
  const q = query.trim();
  if (!q) return null;
  return `${QUERY_SEARCHING_PREFIX}「${q}」`;
}
