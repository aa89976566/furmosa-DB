/**
 * POS 查詢頁 UI 驗收用虛構資料。
 * 僅供測試檔／本機 visual harness 使用，不是真實顧客或交易。
 */
import type { PosAccount } from '@/lib/pos/account';
import type { QueryFeedItem } from '@/lib/pos/query-feed';

export const QUERY_RECORDS_FIXTURE_BANNER =
  '測試 fixture · 虛構資料 · 非 Preview 真實紀錄 · 非 POS↔HQ 同步驗收';

export const QUERY_RECORDS_FIXTURE_ACCOUNT: PosAccount = {
  storeName: '測試 fixture 店家',
  storeCity: '虛構市',
  username: 'fixture-staff',
  staffName: '測試店員',
  phone: null,
  address: null,
  contactName: null,
};

export const QUERY_RECORDS_FIXTURE_LAST_TITLE =
  '測試 fixture 最後一筆－庫存異動捲動檢查';

export const QUERY_RECORDS_FIXTURE_LONG_PRODUCT =
  '測試用超長商品名稱－工業風原木桌板組含延伸件與配件包以及展示用補充說明文字';

export const QUERY_RECORDS_FIXTURE_LONG_SERIAL =
  'FIXTURE-JAR-OLD-00000000000000001234';

export const QUERY_RECORDS_FIXTURE_RESTOCK_ID = 'rst-fixture-0000000000000000000001';

export const QUERY_RECORDS_FIXTURE_CUSTOMER_A = '測試顧客甲';
export const QUERY_RECORDS_FIXTURE_CUSTOMER_B = '虛構會員乙';

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3600_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

/** 查詢列表由新到舊；最後一筆用來檢查手機捲動與底部導航。 */
export const QUERY_RECORDS_FIXTURE_ITEMS: QueryFeedItem[] = [
  {
    id: 'sale-fixture-long-name',
    kind: 'sale',
    at: hoursAgo(1),
    title: `${QUERY_RECORDS_FIXTURE_LONG_PRODUCT} × 1`,
    subtitle: 'NT$1,280',
    status: '已完成',
    href: '/pos/records',
    searchText: `${QUERY_RECORDS_FIXTURE_LONG_PRODUCT} 1280`.toLowerCase(),
  },
  {
    id: 'sale-fixture-short',
    kind: 'sale',
    at: hoursAgo(2),
    title: '虛構飼料A × 2',
    subtitle: 'NT$258',
    status: '已完成',
    href: '/pos/records',
    searchText: '虛構飼料a 258',
  },
  {
    id: 'refill-fixture-done',
    kind: 'refill',
    at: hoursAgo(3),
    title: '換罐',
    subtitle: `#${QUERY_RECORDS_FIXTURE_LONG_SERIAL} → #FIXTURE-JAR-NEW-9`,
    status: '已完成',
    href: '/pos/refill/fixture-done',
    searchText:
      `${QUERY_RECORDS_FIXTURE_CUSTOMER_A} #${QUERY_RECORDS_FIXTURE_LONG_SERIAL} #FIXTURE-JAR-NEW-9 ${QUERY_RECORDS_FIXTURE_LONG_SERIAL} FIXTURE-JAR-NEW-9`.toLowerCase(),
  },
  {
    id: 'refill-fixture-extra',
    kind: 'refill',
    at: hoursAgo(4),
    title: '換罐',
    subtitle: '#FIX-OLD-21 → #FIX-NEW-88',
    status: '等待補差額',
    href: '/pos/refill/fixture-extra',
    searchText: `${QUERY_RECORDS_FIXTURE_CUSTOMER_B} #FIX-OLD-21 #FIX-NEW-88 fix-old-21 fix-new-88`.toLowerCase(),
  },
  {
    id: 'refill-fixture-pending',
    kind: 'refill',
    at: hoursAgo(5),
    title: '換罐',
    subtitle: '舊罐 → 新罐',
    status: '尚未付款',
    href: '/pos/refill/fixture-pending',
    searchText: '測試顧客丙 舊罐 新罐',
  },
  {
    id: 'refill-fixture-processing',
    kind: 'refill',
    at: hoursAgo(6),
    title: '換罐',
    subtitle: '#FIX-OLD-7 → #FIX-NEW-7',
    status: '處理中',
    href: '/pos/refill/fixture-processing',
    searchText: '虛構會員丁 #FIX-OLD-7 #FIX-NEW-7 fix-old-7 fix-new-7',
  },
  {
    id: 'restock-fixture-submitted',
    kind: 'restock',
    at: hoursAgo(7),
    title: '補貨',
    subtitle: '虛構飼料A × 6、展示罐裝潔牙粉 × 2',
    status: '已送出',
    href: `/pos/restock/${QUERY_RECORDS_FIXTURE_RESTOCK_ID}`,
    searchText: `補貨 虛構飼料A × 6、展示罐裝潔牙粉 × 2 ${QUERY_RECORDS_FIXTURE_RESTOCK_ID}`.toLowerCase(),
  },
  {
    id: 'restock-fixture-shipment',
    kind: 'restock',
    at: daysAgo(1),
    title: '補貨',
    subtitle: '虛構飼料B × 12',
    status: '備貨中',
    href: '/pos/restock/fixture-shipment',
    searchText: '補貨 虛構飼料b × 12 rst-fixture-shipment',
  },
  {
    id: 'restock-fixture-rejected',
    kind: 'restock',
    at: daysAgo(2),
    title: '補貨',
    subtitle: '展示用貓砂 × 4',
    status: '需要調整',
    href: '/pos/restock/fixture-rejected',
    searchText: '補貨 展示用貓砂 × 4 rst-fixture-rejected',
  },
  {
    id: 'restock-fixture-cancelled',
    kind: 'restock',
    at: daysAgo(3),
    title: '補貨',
    subtitle: '虛構飼料C × 1',
    status: '已取消',
    href: '/pos/restock/fixture-cancelled',
    searchText: '補貨 虛構飼料c × 1 rst-fixture-cancelled',
  },
  {
    id: 'restock-fixture-draft',
    kind: 'restock',
    at: daysAgo(4),
    title: '補貨',
    subtitle: '補貨單',
    status: '草稿',
    href: '/pos/restock/fixture-draft',
    searchText: '補貨 補貨單 rst-fixture-draft',
  },
  {
    id: 'stock-fixture-in',
    kind: 'stock',
    at: daysAgo(4),
    title: '庫存',
    subtitle: '進貨虛構飼料A ＋8',
    status: '現在 24',
    href: '/pos/stock',
    searchText: '虛構飼料a restock stock-fixture-in',
  },
  {
    id: 'stock-fixture-sale',
    kind: 'stock',
    at: daysAgo(5),
    title: '庫存',
    subtitle: '銷售虛構飼料A -2',
    status: '現在 22',
    href: '/pos/stock',
    searchText: '虛構飼料a sale stock-fixture-sale',
  },
  {
    id: 'stock-fixture-return',
    kind: 'stock',
    at: daysAgo(6),
    title: '庫存',
    subtitle: '退回展示罐裝潔牙粉 ＋1',
    status: '現在 5',
    href: '/pos/stock',
    searchText: '展示罐裝潔牙粉 return stock-fixture-return',
  },
  {
    id: 'stock-fixture-adjust-missing',
    kind: 'stock',
    at: daysAgo(7),
    title: '庫存',
    subtitle: '盤點調整 ＋1',
    status: '現在 0',
    href: '/pos/stock',
    searchText: 'adjust stock-fixture-adjust-missing',
  },
  {
    id: 'stock-fixture-last',
    kind: 'stock',
    at: daysAgo(8),
    title: QUERY_RECORDS_FIXTURE_LAST_TITLE,
    subtitle: `盤點調整${QUERY_RECORDS_FIXTURE_LONG_PRODUCT} -1`,
    status: '現在 3',
    href: '/pos/stock',
    searchText: `${QUERY_RECORDS_FIXTURE_LAST_TITLE} ${QUERY_RECORDS_FIXTURE_LONG_PRODUCT} adjust stock-fixture-last`.toLowerCase(),
  },
];
