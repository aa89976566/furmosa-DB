export type PosNavId = 'home' | 'stock' | 'refill' | 'records' | 'settle';

export type PosNavItem = {
  id: PosNavId;
  href: string;
  label: string;
  /** 給店家人員看的用途說明，不是工程註解。 */
  purpose: string;
  match: (pathname: string) => boolean;
};

/**
 * POS 唯一導航定義。桌機側欄與手機底部選單都必須直接使用這份清單，
 * 不可各自再寫一組名稱或網址。
 */
export const POS_NAV: readonly PosNavItem[] = [
  {
    id: 'home',
    href: '/pos',
    label: '首頁',
    purpose: '今天要處理什麼？',
    match: (p) => p === '/pos' || p === '/pos/',
  },
  {
    id: 'stock',
    href: '/pos/stock',
    label: '庫存',
    purpose: '查看店裡還有哪些商品、數量夠不夠。',
    match: (p) => p === '/pos/stock' || p.startsWith('/pos/stock/'),
  },
  {
    id: 'refill',
    href: '/pos/refill',
    label: '換罐',
    purpose: '掃描空罐，幫客人換成新的。',
    match: (p) => p === '/pos/refill' || p.startsWith('/pos/refill/'),
  },
  {
    id: 'records',
    href: '/pos/records',
    label: '查詢',
    purpose: '查找換罐、補貨和庫存異動。',
    match: (p) => p === '/pos/records' || p.startsWith('/pos/records/'),
  },
  {
    id: 'settle',
    href: '/pos/settle',
    label: '結帳',
    purpose: '查看這期要跟匠寵對的帳。',
    match: (p) => p === '/pos/settle' || p.startsWith('/pos/settle/'),
  },
] as const;

export type PosHomeAction = {
  navId: Exclude<PosNavId, 'home'>;
  title: string;
  purpose: string;
};

/** 登入後首頁的固定操作入口。不查新資料、不捏造數字。 */
export const POS_HOME_ACTIONS: readonly PosHomeAction[] = [
  {
    navId: 'refill',
    title: '幫客人換罐',
    purpose: '掃描空罐，幫客人換成新的。',
  },
  {
    navId: 'stock',
    title: '查看庫存',
    purpose: '看看店裡還有哪些商品、數量夠不夠。',
  },
  {
    navId: 'records',
    title: '查詢紀錄',
    purpose: '查找換罐、補貨和庫存異動。',
  },
  {
    navId: 'settle',
    title: '查看本期對帳',
    purpose: '查看這期要跟匠寵對的帳。',
  },
] as const;

export function posNavItem(id: PosNavId): PosNavItem {
  const item = POS_NAV.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`未知的店家選單：${id}`);
  }
  return item;
}

export function activePosNavId(pathname: string): PosNavId | null {
  return POS_NAV.find((item) => item.match(pathname))?.id ?? null;
}
