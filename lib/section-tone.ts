export const SECTION_TONES = [
  'overview',
  'master',
  'orders',
  'logistics',
  'subscription',
  'inventory',
  'finance',
  'supply',
  'operations',
] as const;

export type SectionTone = (typeof SECTION_TONES)[number];

type SectionToneStyle = {
  label: string;
  chip: string;
  header: string;
  card: string;
  cardBorder: string;
  icon: string;
  marker: string;
  eyebrow: string;
  sidebar: string;
  sidebarActive: string;
};

/** 全站統一成匠寵色相，不再用彩虹分區 */
const BRAND: SectionToneStyle = {
  label: 'Furmosa',
  chip: 'bg-primary/10 text-primary',
  header: 'border-border/60 bg-secondary/40',
  card: 'bg-card',
  cardBorder: 'border-border/70',
  icon: 'bg-primary/10 text-primary',
  marker: 'bg-primary',
  eyebrow: 'text-sage',
  sidebar: 'text-muted-foreground',
  sidebarActive: 'bg-primary/10 text-ink ring-primary/15',
};

export const sectionToneStyles: Record<SectionTone, SectionToneStyle> = {
  overview: { ...BRAND, label: '總覽' },
  master: { ...BRAND, label: '主資料' },
  orders: { ...BRAND, label: '訂單' },
  logistics: { ...BRAND, label: '物流' },
  subscription: { ...BRAND, label: '訂閱' },
  inventory: { ...BRAND, label: '庫存' },
  supply: { ...BRAND, label: '換罐' },
  finance: { ...BRAND, label: '財務' },
  operations: { ...BRAND, label: '營運' },
};

export function getRouteTone(pathname: string): SectionTone {
  if (pathname === '/' || pathname.startsWith('/dashboard')) return 'overview';
  if (
    pathname.startsWith('/vendors') ||
    pathname.startsWith('/customers') ||
    pathname.startsWith('/merchants') ||
    pathname.startsWith('/products')
  ) {
    return 'master';
  }
  if (pathname.startsWith('/orders')) return 'orders';
  if (pathname.startsWith('/shipments')) return 'logistics';
  if (pathname.startsWith('/subscriptions')) return 'subscription';
  if (pathname.startsWith('/inventory')) return 'inventory';
  if (pathname.startsWith('/supply') || pathname.startsWith('/jar-exchange')) return 'supply';
  if (pathname.startsWith('/settlements') || pathname.startsWith('/merchants/settlements')) {
    return 'finance';
  }
  if (pathname.startsWith('/tasks')) return 'operations';
  return 'overview';
}
