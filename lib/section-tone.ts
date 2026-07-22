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

/** Polaris-like subdued tones: calm markers, minimal color noise */
const calmTone = (label: string): SectionToneStyle => ({
  label,
  chip: 'bg-muted text-muted-foreground',
  header: 'border-border/60 bg-muted/40',
  card: 'bg-card',
  cardBorder: 'border-border/70',
  icon: 'bg-muted text-foreground',
  marker: 'bg-primary',
  eyebrow: 'text-muted-foreground',
  sidebar: 'text-muted-foreground',
  sidebarActive: 'bg-accent text-accent-foreground ring-primary/15',
});

export const sectionToneStyles: Record<SectionTone, SectionToneStyle> = {
  overview: calmTone('總覽'),
  master: {
    ...calmTone('主資料'),
    marker: 'bg-sky-500',
    sidebarActive: 'bg-sky-500/10 text-navy ring-sky-500/15',
  },
  orders: {
    ...calmTone('訂單'),
    marker: 'bg-primary',
    chip: 'bg-primary/10 text-primary',
    eyebrow: 'text-primary',
    sidebarActive: 'bg-primary/10 text-navy ring-primary/15',
  },
  logistics: {
    ...calmTone('物流'),
    marker: 'bg-amber-500',
    sidebarActive: 'bg-amber-500/10 text-navy ring-amber-500/15',
  },
  subscription: {
    ...calmTone('訂閱'),
    marker: 'bg-slate-500',
    sidebarActive: 'bg-slate-500/10 text-navy ring-slate-500/15',
  },
  inventory: {
    ...calmTone('庫存'),
    marker: 'bg-emerald-500',
    sidebarActive: 'bg-emerald-500/10 text-navy ring-emerald-500/15',
  },
  supply: {
    ...calmTone('補給站'),
    marker: 'bg-neutral-400',
    sidebarActive: 'bg-neutral-500/10 text-navy ring-neutral-400/20',
  },
  finance: {
    ...calmTone('財務'),
    marker: 'bg-success',
    chip: 'bg-success/10 text-success',
    sidebarActive: 'bg-success/10 text-navy ring-success/15',
  },
  operations: {
    ...calmTone('營運'),
    marker: 'bg-info',
    sidebarActive: 'bg-info/10 text-navy ring-info/15',
  },
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
