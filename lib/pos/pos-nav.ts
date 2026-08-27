export type PosNavId = 'sell' | 'stock' | 'refill' | 'restock' | 'records';

export type PosNavItem = {
  id: PosNavId;
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

export const POS_NAV: readonly PosNavItem[] = [
  {
    id: 'sell',
    href: '/pos/sell',
    label: '結帳',
    match: (p) => p === '/pos/sell' || p.startsWith('/pos/sell/'),
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
    match: (p) => p === '/pos/refill' || p.startsWith('/pos/refill/'),
  },
  {
    id: 'restock',
    href: '/pos/restock',
    label: '補貨',
    match: (p) => p === '/pos/restock' || p.startsWith('/pos/restock/'),
  },
  {
    id: 'records',
    href: '/pos/records',
    label: '查詢',
    match: (p) => p === '/pos/records' || p.startsWith('/pos/records/'),
  },
] as const;

export function activePosNavId(pathname: string): PosNavId | null {
  return POS_NAV.find((item) => item.match(pathname))?.id ?? null;
}
