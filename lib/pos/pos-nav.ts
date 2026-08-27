export type PosNavId = 'sell' | 'today' | 'restock' | 'refill' | 'records';

export type PosNavItem = {
  id: PosNavId;
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

export const POS_NAV: readonly PosNavItem[] = [
  {
    id: 'sell',
    href: '/pos',
    label: '收銀',
    match: (p) => p === '/pos',
  },
  {
    id: 'today',
    href: '/pos/today',
    label: '今天',
    match: (p) => p === '/pos/today' || p.startsWith('/pos/appointments'),
  },
  {
    id: 'restock',
    href: '/pos/restock',
    label: '叫貨',
    match: (p) => p === '/pos/restock' && !p.startsWith('/pos/restock/'),
  },
  {
    id: 'refill',
    href: '/pos/refill',
    label: '換罐',
    match: (p) =>
      p === '/pos/refill' ||
      p.startsWith('/pos/refill/') ||
      p.startsWith('/pos/restock/'),
  },
  {
    id: 'records',
    href: '/pos/records',
    label: '紀錄',
    match: (p) => p === '/pos/records' || p.startsWith('/pos/records/'),
  },
] as const;

export function activePosNavId(pathname: string): PosNavId | null {
  return POS_NAV.find((item) => item.match(pathname))?.id ?? null;
}
