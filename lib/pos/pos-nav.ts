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
    href: '/pos/sell',
    label: '收銀',
    match: (p) => p === '/pos' || p === '/pos/sell',
  },
  {
    id: 'stock',
    href: '/pos/stock',
    label: '庫存',
    match: (p) => p === '/pos/stock' || p.startsWith('/pos/stock/'),
  },
  {
    id: 'refill',
    href: '/pos/coupons',
    label: '美容券',
    match: (p) =>
      p === '/pos/coupons' ||
      p.startsWith('/pos/coupons/') ||
      p === '/pos/refill' ||
      p.startsWith('/pos/refill/'),
  },
  {
    id: 'records',
    href: '/pos/records',
    label: '紀錄',
    match: (p) => p === '/pos/records' || p.startsWith('/pos/records/'),
  },
  {
    id: 'settle',
    href: '/pos/settle',
    label: '對帳',
    match: (p) => p === '/pos/settle' || p.startsWith('/pos/settle/'),
  },
] as const;

export function activePosNavId(pathname: string): PosNavId | null {
  return POS_NAV.find((item) => item.match(pathname))?.id ?? null;
}
