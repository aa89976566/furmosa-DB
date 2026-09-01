export type PosNavId = 'home' | 'stock' | 'refill' | 'records' | 'settle';

export type PosNavItem = {
  id: PosNavId;
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

export const POS_NAV: readonly PosNavItem[] = [
  {
    id: 'home',
    href: '/pos',
    label: '首頁',
    match: (p) => p === '/pos',
  },
  {
    id: 'stock',
    href: '/pos/stock',
    label: '庫存',
    match: (p) => p === '/pos/stock' || p.startsWith('/pos/stock/'),
  },
  {
    id: 'refill',
    href: '/pos/refill',
    label: '換罐',
    match: (p) =>
      p === '/pos/refill' ||
      p.startsWith('/pos/refill/') ||
      p === '/pos/restock' ||
      p.startsWith('/pos/restock/'),
  },
  {
    id: 'records',
    href: '/pos/records',
    label: '查詢',
    match: (p) => p === '/pos/records' || p.startsWith('/pos/records/'),
  },
  {
    id: 'settle',
    href: '/pos/settle',
    label: '結帳',
    match: (p) => p === '/pos/settle' || p.startsWith('/pos/settle/'),
  },
] as const;

export function activePosNavId(pathname: string): PosNavId | null {
  return POS_NAV.find((item) => item.match(pathname))?.id ?? null;
}
