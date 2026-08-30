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

const MONO: Omit<SectionToneStyle, 'label'> = {
  chip: 'bg-neutral-900/10 text-neutral-800 dark:text-neutral-200',
  header: 'border-border/60 bg-neutral-900/[0.04]',
  card: 'bg-card',
  cardBorder: 'border-neutral-300/70 dark:border-neutral-600/40',
  icon: 'bg-neutral-900/10 text-neutral-800 dark:text-neutral-200',
  marker: 'bg-neutral-900 dark:bg-neutral-200',
  eyebrow: 'text-neutral-600 dark:text-neutral-400',
  sidebar: 'text-muted-foreground',
  sidebarActive: 'bg-neutral-900/10 text-navy ring-neutral-900/15',
};

export const sectionToneStyles: Record<SectionTone, SectionToneStyle> = {
  overview: { label: '總覽', ...MONO },
  master: { label: '主資料', ...MONO },
  orders: { label: '訂單', ...MONO },
  logistics: { label: '物流', ...MONO },
  subscription: { label: '訂閱', ...MONO },
  inventory: { label: '庫存', ...MONO },
  supply: { label: '補給站', ...MONO },
  finance: { label: '財務', ...MONO },
  operations: { label: '營運', ...MONO },
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
  if (
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/reviews') ||
    pathname.startsWith('/campaigns')
  ) {
    return 'operations';
  }
  return 'overview';
}
